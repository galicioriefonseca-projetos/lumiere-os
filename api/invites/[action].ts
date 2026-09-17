import type { VercelRequest, VercelResponse } from '@vercel/node';
import resolveInviteHandler from '../../server/routes/invites/resolve.js';
import acceptInviteHandler from '../../server/routes/invites/accept.js';

/**
 * Dedicated invite API entrypoint.
 *
 * The application previously depended on the root catch-all API function for
 * /api/invites/*, but that route is not being exposed by the current Vercel
 * deployment. Keeping invites in one dynamic function preserves the Hobby
 * function budget while making both endpoints explicit and reliable.
 */
export default async function invites(req: VercelRequest, res: VercelResponse) {
  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;

  if (action === 'resolve') {
    return resolveInviteHandler(req, res);
  }

  if (action === 'accept') {
    return acceptInviteHandler(req, res);
  }

  res.status(404).json({ error: 'Rota de convite não encontrada.' });
}
