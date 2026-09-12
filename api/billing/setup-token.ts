import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateSetupTokenHandler } from '../../server/routes/billing/setup-company.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return validateSetupTokenHandler(req, res);
}
