import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverless from 'serverless-http';
import app from '../server/app.js';

/**
 * Single catch-all Serverless Function for the Express API.
 * This keeps the API surface within Vercel's Hobby function limit while
 * preserving all routes registered in server/app.ts.
 */
const handler = serverless(app);

export default function api(req: VercelRequest, res: VercelResponse) {
  return handler(req as any, res as any);
}
