import type { VercelRequest, VercelResponse } from '@vercel/node';
import subscriptionStatusHandler from '../../server/routes/billing/subscription-status.js';

/** Explicit Vercel Serverless Function entrypoint for subscription status. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return subscriptionStatusHandler(req, res);
}
