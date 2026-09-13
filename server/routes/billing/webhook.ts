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

    // Segurança: webhook deve falhar fechado.
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
    const customerId = body.checkout?.customer || body.payment?.customer || body.subscription?.customer || body.customer;
    const externalReference = String(
      body.checkout?.externalReference ||
      body.subscription?.externalReference ||
      body.payment?.externalReference ||
      ''
    );
    const checkoutId = String(body.checkout?.id || '');

    // Checkout de migração usa externalReference=manual-migration:{salonId}.
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
              pendingMigration: event !== 'PAYMENT_RECEIVED' && event !== 'PAYMENT_CONFIRMED' && event !== 'CHECKOUT_PAID'
            },
            asaasCustomerId: customerId
          }, { merge: true });
        }
      }
    }

    console.log(`[Asaas Webhook] Nova notificação recebida. Evento: ${event}`);

    // O Checkout hospedado pelo Asaas confirma a jornada através de CHECKOUT_PAID.
    // PAYMENT_RECEIVED/PAYMENT_CONFIRMED continuam sendo processados para cobranças
    // recorrentes posteriores.
    if (event === 'CHECKOUT_PAID' || event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      try {
        let targetSalonId = '';
        let targetSalonData: any = null;

        if (externalReference.startsWith('manual-migration:')) {
          targetSalonId = externalReference.slice('manual-migration:'.length);
        } else if (externalReference) {
          const directRef = await adminDb.collection('salons').doc(externalReference).get();
          if (directRef.exists) {
            targetSalonId = directRef.id;
            targetSalonData = directRef.data();
          }
        }

        if (!targetSalonId && checkoutId) {
          const checkoutSnapshot = await adminDb.collection('salons')
            .where('billing.checkoutId', '==', checkoutId)
            .limit(1)
            .get();
          const sDoc = checkoutSnapshot.docs?.[0];
          if (sDoc && sDoc.exists) {
            targetSalonId = sDoc.id;
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

        if (targetSalonId && !targetSalonData) {
          const sDoc = await adminDb.collection('salons').doc(targetSalonId).get();
          if (sDoc.exists) targetSalonData = sDoc.data();
        }

        if (targetSalonId && targetSalonData) {
          const salonRef = adminDb.collection('salons').doc(targetSalonId);
          const isAlreadyConfigured = targetSalonData.onboardingCompleted === true;
          const isCheckoutPaid = event === 'CHECKOUT_PAID';

          await salonRef.set({
            status: 'active',
            subscriptionStatus: 'active',
            activationStatus: 'active',
            isActive: true,
            paymentStatus: 'confirmed',
            onboardingStatus: isAlreadyConfigured ? 'completed' : 'pending_setup',
            billing: {
              ...(targetSalonData.billing || {}),
              provider: 'asaas',
              ...(customerId ? { customerId } : {}),
              ...(checkoutId ? { checkoutId, checkoutStatus: isCheckoutPaid ? 'PAID' : (targetSalonData.billing?.checkoutStatus || 'PAID') } : {}),
              lastPaymentEvent: event,
              lastPaymentEventAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            updatedAt: Date.now()
          }, { merge: true });

          if (targetSalonData.ownerId) {
            const userRef = adminDb.collection('users').doc(targetSalonData.ownerId);
            await userRef.set({
              role: 'owner',
              onboardingStatus: isAlreadyConfigured ? 'completed' : 'pending_setup',
              updatedAt: Date.now()
            }, { merge: true });
          }

          // Não crie tokens infinitamente quando o Asaas reenviar o mesmo evento.
          let setupToken = '';
          const existingToken = targetSalonData.setupToken;
          if (existingToken?.token && existingToken.used === false && new Date(existingToken.expiresAt || 0).getTime() > Date.now()) {
            setupToken = existingToken.token;
          } else {
            setupToken = `${crypto.randomUUID()}-${crypto.randomBytes(16).toString('hex')}`;
            const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
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
          }

          const recipientEmail = targetSalonData.ownerEmail ||
            targetSalonData.billingEmail ||
            body.checkout?.customerData?.email ||
            body.payment?.customerEmail ||
            body.customer?.email;

          if (recipientEmail && setupToken && (!existingToken?.token || existingToken.token !== setupToken || event === 'CHECKOUT_PAID')) {
            const appUrl = (env.app.url || 'https://lumiere-os.vercel.app').replace(/\/+$/, '');
            const setupUrl = `${appUrl}/dashboard/configurar-empresa?token=${encodeURIComponent(setupToken)}`;
            const ownerName = targetSalonData.ownerName || targetSalonData.name || body.checkout?.customerData?.name || body.payment?.customerName;

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
