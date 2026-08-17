import type { VercelRequest, VercelResponse } from '@vercel/node';
import createCheckoutHandler from '../../server/routes/billing/create-checkout.js';

/**
 * Explicit Vercel Serverless Function entrypoint for creating the Asaas checkout.
 * Keeping this route explicit avoids relying on the generic catch-all API route.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return createCheckoutHandler(req, res);
}
