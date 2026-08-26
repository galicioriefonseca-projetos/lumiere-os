import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { billingService } from '../../billing/BillingService.js';
import { env } from '../../config/env.js';

function getWebhookToken(req: VercelRequest): string {
  const raw = req.headers['asaas-access-token'];
  if (Array.isArray(raw)) return raw[0] || '';
  return typeof raw === 'string' ? raw.trim() : '';
}

export default async function asaasWebhookHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== 'POST') {
    if (typeof res.setHeader === 'function') res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const adminDb = getAdminDb();
    const billingSettingsDoc = await adminDb.collection('settings').doc('asaas').get();
    const billingSettings = billingSettingsDoc.data() || {};
    const expectedToken = String(env.asaas.webhookToken || billingSettings.webhookToken || '').trim();
    const receivedToken = getWebhookToken(req);

    // Fail closed: without a configured secret, the public webhook cannot accept events.
    if (!expectedToken) {
      console.error('[Asaas Webhook] Webhook token não configurado. Evento rejeitado por segurança.');
      return res.status(503).json({ error: 'Webhook não configurado.' });
    }

    if (!receivedToken || receivedToken !== expectedToken) {
      console.warn('[Asaas Webhook] Tentativa de acesso não autorizada com token inválido.');
      return res.status(401).json({ error: 'Token inválido' });
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || !body.event) {
      console.warn('[Asaas Webhook] Payload inválido ou ausente recebido do Asaas.');
      return res.status(400).json({ error: 'Payload de webhook inválido ou sem evento definido.' });
    }

    const { event } = body;
    const customerId = body.payment?.customer || body.subscription?.customer || body.customer;
    const externalReference = String(body.subscription?.externalReference || body.payment?.externalReference || '');

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
