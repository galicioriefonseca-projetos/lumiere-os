import type { VercelRequest, VercelResponse } from '@vercel/node';
import customerDataHandler from '../../server/routes/billing/customer-data.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return customerDataHandler(req, res);
}
