import type { VercelRequest, VercelResponse } from '@vercel/node';
import asaasTestConnectionHandler from '../../server/routes/billing/test-connection.js';

/**
 * Vercel Serverless Function entrypoint for the Asaas connection test.
 *
 * The business logic lives in server/routes/billing/test-connection.ts. This
 * explicit adapter ensures /api/billing/test-connection is deployed as a
 * concrete Vercel Function instead of relying on the generic catch-all API
 * route.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return asaasTestConnectionHandler(req, res);
}
