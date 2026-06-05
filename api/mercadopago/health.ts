import { Request, Response } from 'express';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';

export default async function healthMP(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const hasAccessToken = !!process.env.MERCADOPAGO_ACCESS_TOKEN;
  const hasWebhookSecret = !!process.env.MERCADOPAGO_WEBHOOK_SECRET;

  return res.json({
    ok: true,
    mercadoPagoConfigured: hasAccessToken,
    mercadoPagoWebhookConfigured: hasWebhookSecret,
    appUrlConfigured: !!process.env.APP_URL,
    hasFounderAmount: !!process.env.MP_PLAN_FOUNDER_AMOUNT,
    environment: process.env.NODE_ENV || 'development'
  });
}
