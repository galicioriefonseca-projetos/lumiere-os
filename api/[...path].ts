import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/app.js';

/**
 * Single catch-all Serverless Function for the Express API.
 * Normalizes req.url to guarantee Express route matching across local, Vercel and cloud runtimes.
 */
export default function api(req: VercelRequest, res: VercelResponse) {
  if (req.url) {
    // If Vercel stripped the /api prefix, restore it for Express routing
    if (!req.url.startsWith('/api/') && req.url !== '/api') {
      req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
    }
  }
  return app(req as any, res as any);
}

