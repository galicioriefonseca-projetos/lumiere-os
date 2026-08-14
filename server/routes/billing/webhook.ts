import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { billingService } from '../../billing/BillingService.js';

export default async function asaasWebhookHandler(req: VercelRequest, res: VercelResponse) {
  // 1. Garantir o método HTTP correto (se explicitamente fornecido)
  if (req.method && req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    // 2. Obter as configurações de autenticação do Asaas no Firestore
    const adminDb = getAdminDb();
    const billingSettingsDoc = await adminDb.collection('settings').doc('asaas').get();
    const billingSettings = billingSettingsDoc.data();

    // 3. Autenticação e assinatura do webhook
    const token = req.headers['asaas-access-token'];
    if (billingSettings?.webhookToken && token !== billingSettings.webhookToken) {
      console.warn('[Asaas Webhook] Tentativa de acesso não autorizada com token inválido.');
      return res.status(401).json({ error: 'Token inválido' });
    }

    // 4. Validar payload básico
    const body = req.body;
    if (!body || typeof body !== 'object' || !body.event) {
      console.warn('[Asaas Webhook] Payload inválido ou ausente recebido do Asaas.');
      return res.status(400).json({ error: 'Payload de webhook inválido ou sem evento definido.' });
    }

    const { event } = body;
    console.log(`[Asaas Webhook] Nova notificação recebida de forma segura. Evento: ${event}`);

    // 5. Delegar processamento ao BillingService resiliente
    await billingService.handleWebhook(event, body);

    // Retornar 200 para confirmar o processamento bem-sucedido
    return res.status(200).json({ received: true });

  } catch (error: any) {
    console.error('[Asaas Webhook Error] Falha de infraestrutura durante processamento:', error);
    // Retornar 500 para forçar o mecanismo de retry automático do Asaas
    return res.status(500).json({ error: 'Erro interno temporário no processamento do faturamento.' });
  }
}
