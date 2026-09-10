import type { VercelRequest, VercelResponse } from '@vercel/node';
import asaasWebhookHandler from '../../server/routes/billing/webhook.js';

/**
 * Vercel Serverless Function entrypoint for the Asaas webhook.
 *
 * The business logic lives in server/routes/billing/webhook.ts; this thin
 * adapter exposes it at the public /api/billing/webhook URL expected by
 * Asaas. Keeping the adapter small avoids duplicating authentication,
 * idempotency and billing logic.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return asaasWebhookHandler(req, res);
}
