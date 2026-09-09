import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverless from 'serverless-http';
import app from '../server/app.js';

const handler = serverless(app);

export default async function api(req: VercelRequest, res: VercelResponse) {
  return handler(req as any, res as any);
}
