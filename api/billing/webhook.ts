import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Explicit Vercel entrypoint for the Asaas webhook.
 *
 * The import is intentionally lazy: the billing stack validates its server
 * environment during module initialization, so Vercel must not load it for
 * unsupported HTTP methods or during function bootstrap.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const { default: asaasWebhookHandler } = await import('../../server/routes/billing/webhook.js');
    return await asaasWebhookHandler(req, res);
  } catch (error) {
    console.error('[Asaas Webhook Vercel] Falha ao carregar/executar o handler:', error);
    return res.status(500).json({ error: 'Erro interno temporário no processamento do faturamento.' });
  }
}
