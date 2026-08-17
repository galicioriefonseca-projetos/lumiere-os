import type { VercelRequest, VercelResponse } from '@vercel/node';
import changePlanHandler from '../../server/routes/billing/change-plan.js';

/** Explicit Vercel Serverless Function entrypoint for billing plan changes. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return changePlanHandler(req, res);
}
