import type { VercelRequest, VercelResponse } from '@vercel/node';
import { completeCompanySetupHandler } from '../../server/routes/billing/setup-company.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return completeCompanySetupHandler(req, res);
}
