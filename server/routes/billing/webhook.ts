import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { billingService } from '../../billing/BillingService.js';
import { sendCompanySetupEmail } from '../../shared/email.js';
import { env } from '../../config/env.js';

export default async function asaasWebhookHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== 'POST') {
    if (typeof res.setHeader === 'function') res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const adminDb = getAdminDb();
    const billingSettingsDoc = await adminDb.collection('settings').doc('asaas').get();
    const billingSettings = billingSettingsDoc.data();

    const configuredToken = typeof billingSettings?.webhookToken === 'string'
      ? billingSettings.webhookToken.trim()
      : '';
    const receivedHeader = req.headers['asaas-access-token'];
    const receivedToken = Array.isArray(receivedHeader)
      ? receivedHeader[0]?.trim() || ''
      : String(receivedHeader || '').trim();

    // Segurança: webhook deve falhar fechado. Sem segredo configurado, sem
    // cabeçalho ou com segredo divergente, nenhum evento pode ser processado.
    if (!configuredToken || !receivedToken || receivedToken !== configuredToken) {
      console.warn('[Asaas Webhook] Requisição rejeitada: autenticação do webhook inválida ou não configurada.');
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || !body.event) {
      console.warn('[Asaas Webhook] Payload inválido ou ausente recebido do Asaas.');
      return res.status(400).json({ error: 'Payload de webhook inválido ou sem evento definido.' });
    }

    const { event } = body;
    const customerId = body.payment?.customer || body.subscription?.customer || body.customer;
    const externalReference = String(body.subscription?.externalReference || body.payment?.externalReference || '');

    // Checkout de migração usa externalReference=manual-migration:{salonId}.
    // O Checkout pode criar/vincular o cliente no Asaas sem o externalReference do
    // salão no documento local. Reconciliamos essa relação antes do processamento
    // normal para que os eventos seguintes (inclusive PAYMENT_RECEIVED) não caiam na DLQ.
    if (customerId && externalReference.startsWith('manual-migration:')) {
      const salonId = externalReference.slice('manual-migration:'.length);
      if (salonId) {
        const salonRef = adminDb.collection('salons').doc(salonId);
        const salonDoc = await salonRef.get();
        if (salonDoc.exists) {
          await salonRef.set({
            billing: {
              customerId,
              provider: 'asaas',
              pendingMigration: event !== 'PAYMENT_RECEIVED' && event !== 'PAYMENT_CONFIRMED'
            },
            asaasCustomerId: customerId
          }, { merge: true });
        }
      }
    }

    console.log(`[Asaas Webhook] Nova notificação recebida. Evento: ${event}`);

    // Processamento específico para confirmação de pagamento:
    // Atualiza o status do salon no Firestore para 'active' e dispara o envio de e-mail
    // com link exclusivo para /dashboard/configurar-empresa contendo token de sessão única.
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      try {
        let targetSalonId = '';
        let targetSalonData: any = null;

        if (externalReference.startsWith('manual-migration:')) {
          targetSalonId = externalReference.slice('manual-migration:'.length);
        }

        if (targetSalonId) {
          const sDoc = await adminDb.collection('salons').doc(targetSalonId).get();
          if (sDoc.exists) {
            targetSalonData = sDoc.data();
          }
        }

        if (!targetSalonId && customerId) {
          const salonsSnapshot = await adminDb.collection('salons')
            .where('billing.customerId', '==', customerId)
            .limit(1)
            .get();
          let sDoc = salonsSnapshot.docs?.[0];
          if (!sDoc) {
            const legacySnapshot = await adminDb.collection('salons')
              .where('asaasCustomerId', '==', customerId)
              .limit(1)
              .get();
            sDoc = legacySnapshot.docs?.[0];
          }
          if (sDoc && sDoc.exists) {
            targetSalonId = sDoc.id;
            targetSalonData = sDoc.data();
          }
        }

        if (targetSalonId && targetSalonData) {
          const salonRef = adminDb.collection('salons').doc(targetSalonId);
          const isAlreadyConfigured = targetSalonData.onboardingCompleted === true;

          // 1. Atualiza status do salon no Firestore para 'active'
          await salonRef.set({
            status: 'active',
            subscriptionStatus: 'active',
            activationStatus: 'active',
            isActive: true,
            paymentStatus: 'confirmed',
            onboardingStatus: isAlreadyConfigured ? 'completed' : 'pending_setup',
            updatedAt: Date.now()
          }, { merge: true });

          // 2. Atualiza status do usuário proprietário
          if (targetSalonData.ownerId) {
            const userRef = adminDb.collection('users').doc(targetSalonData.ownerId);
            await userRef.set({
              role: 'owner',
              onboardingStatus: isAlreadyConfigured ? 'completed' : 'pending_setup',
              updatedAt: Date.now()
            }, { merge: true });
          }

          // 3. Gera token de segurança de sessão única para a rota /dashboard/configurar-empresa
          const setupToken = `${crypto.randomUUID()}-${crypto.randomBytes(16).toString('hex')}`;
          const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(); // 72h

          await adminDb.collection('setup_tokens').doc(setupToken).set({
            token: setupToken,
            salonId: targetSalonId,
            ownerId: targetSalonData.ownerId || '',
            email: targetSalonData.ownerEmail || targetSalonData.billingEmail || '',
            used: false,
            createdAt: new Date().toISOString(),
            expiresAt
          });

          await salonRef.set({
            setupToken: {
              token: setupToken,
              used: false,
              createdAt: new Date().toISOString(),
              expiresAt
            }
          }, { merge: true });

          // 4. Dispara envio de e-mail transacional via SDK do Resend
          const recipientEmail = targetSalonData.ownerEmail ||
            targetSalonData.billingEmail ||
            body.payment?.customerEmail ||
            body.customer?.email;

          if (recipientEmail) {
            const appUrl = (env.app.url || 'https://lumiere-os.vercel.app').replace(/\/+$/, '');
            const setupUrl = `${appUrl}/dashboard/configurar-empresa?token=${encodeURIComponent(setupToken)}`;
            const ownerName = targetSalonData.ownerName || targetSalonData.name || body.payment?.customerName;

            sendCompanySetupEmail({
              to: recipientEmail,
              ownerName,
              setupUrl,
              salonName: targetSalonData.name,
              planName: targetSalonData.plan
            }).catch(emailError => {
              console.error('[Asaas Webhook] Erro assíncrono ao enviar e-mail transacional com Resend:', emailError);
            });
          }
        }
      } catch (activationErr) {
        console.error('[Asaas Webhook] Erro ao ativar estabelecimento e gerar token de onboarding:', activationErr);
      }
    }

    await billingService.handleWebhook(event, body);
    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Asaas Webhook Error] Falha de infraestrutura durante processamento:', error);
    return res.status(500).json({ error: 'Erro interno temporário no processamento do faturamento.' });
  }
}

