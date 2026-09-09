import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/app.js';

/**
 * Single catch-all Serverless Function for the Express API.
 * Vercel's Node runtime natively supports the Express request/response handler.
 * Keeping a single catch-all function avoids exceeding the Hobby plan limit.
 */
export default function api(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
