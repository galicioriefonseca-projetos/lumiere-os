import type { VercelRequest, VercelResponse } from '@vercel/node';
import changeCycleHandler from '../../server/routes/billing/change-cycle.js';

/** Explicit Vercel Serverless Function entrypoint for subscription billing-cycle changes. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return changeCycleHandler(req, res);
}
