import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../../server/app.js';

/**
 * Dedicated Vercel Serverless Function entrypoint for Lumière Daily Insights.
 * Ensures instant routing without depending on dynamic wildcard matching.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.url) {
    if (!req.url.startsWith('/api/')) {
      req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
    }
  }
  return app(req as any, res as any);
}
