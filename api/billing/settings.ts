import type { VercelRequest, VercelResponse } from '@vercel/node';
import asaasSettingsHandler from '../../server/routes/billing/settings.js';

/**
 * Vercel Serverless Function entrypoint for Asaas settings.
 *
 * The business logic lives in server/routes/billing/settings.ts. This explicit
 * adapter ensures /api/billing/settings is deployed as a concrete Vercel
 * Function instead of relying on the generic catch-all API route.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return asaasSettingsHandler(req, res);
}
