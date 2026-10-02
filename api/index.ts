import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/app.js';

/**
 * Single Unified Serverless Function for LumièreOS Express API.
 * Handles 100% of backend routes (/api/billing, /api/auth, /api/ai, /api/push, /api/invites, etc.)
 * within a single Serverless function deployment to comply with Vercel Hobby limits (1 function used out of 12 max).
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.url) {
    // Ensure Express matches the route regardless of whether Vercel passed /api or stripped it
    if (!req.url.startsWith('/api/') && req.url !== '/api') {
      req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
    }
  }
  return app(req as any, res as any);
}
