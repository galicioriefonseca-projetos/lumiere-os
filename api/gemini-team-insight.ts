import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/app.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.url && !req.url.startsWith('/api/')) {
    req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
  }
  return app(req as any, res as any);
}
