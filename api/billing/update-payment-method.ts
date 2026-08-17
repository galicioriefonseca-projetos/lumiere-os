import type { VercelRequest, VercelResponse } from '@vercel/node';
import asaasUpdatePaymentMethodHandler from '../../server/routes/billing/update-payment-method.js';

/**
 * Vercel Serverless Function entrypoint for updating the payment method.
 * The business logic remains in server/routes/billing/update-payment-method.ts.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return asaasUpdatePaymentMethodHandler(req, res);
}
