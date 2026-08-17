import type { VercelRequest, VercelResponse } from '@vercel/node';
import asaasRealSubscriptionHandler from '../../server/routes/billing/real-subscription.js';

/**
 * Vercel Serverless Function entrypoint for reading the real Asaas subscription.
 * The business logic remains in server/routes/billing/real-subscription.ts.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return asaasRealSubscriptionHandler(req, res);
}
