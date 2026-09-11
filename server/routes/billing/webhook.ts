import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { billingService } from '../../billing/BillingService.js';

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
    await billingService.handleWebhook(event, body);
    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Asaas Webhook Error] Falha de infraestrutura durante processamento:', error);
    return res.status(500).json({ error: 'Erro interno temporário no processamento do faturamento.' });
  }
}
