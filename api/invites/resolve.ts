import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb, isFirebaseAdminCredentialError } from "../_shared/firebaseAdmin.js";

export default async function resolveInvite(req: VercelRequest, res: VercelResponse) {
  // Configuração CORS básica
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { inviteId } = req.query;

    if (!inviteId || typeof inviteId !== 'string' || inviteId.length < 5) {
      return res.status(400).json({ error: 'Convite inválido ou mal formatado.' });
    }

    const adminDb = getAdminDb();
    const inviteRef = adminDb.collection("invites").doc(inviteId);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      return res.status(404).json({ error: 'Convite não encontrado ou inválido.' });
    }

    const inviteData = inviteSnap.data() || {};
    
    // Status validation
    if (inviteData.status !== "pending") {
      return res.status(400).json({ error: 'Este convite já foi utilizado ou não é mais válido.' });
    }
    
    // Expiration validation
    if (inviteData.expiresAt && typeof inviteData.expiresAt === 'number') {
      if (Date.now() > inviteData.expiresAt) {
        return res.status(400).json({ error: 'Este convite está expirado.' });
      }
    }
    
    // Use count validation for link types
    if (inviteData.inviteType === 'function_link' || inviteData.inviteType === 'team_public_link') {
      if (inviteData.usesCount !== undefined && inviteData.maxUses !== undefined) {
        if (inviteData.usesCount >= inviteData.maxUses) {
          return res.status(400).json({ error: 'O limite de uso deste convite foi atingido.' });
        }
      }
    }

    // Sanitized return data
    const sanitizedResponse: any = {
      inviteId: inviteSnap.id,
      inviteType: inviteData.inviteType,
      role: inviteData.role,
      salonId: inviteData.salonId
    };

    if (inviteData.email) {
      const parts = inviteData.email.split("@");
      if (parts.length === 2) {
        const namePart = parts[0];
        const maskedName = namePart.length > 2 
          ? `${namePart.substring(0, 2)}***` 
          : `${namePart[0]}***`;
        sanitizedResponse.maskedEmail = `${maskedName}@${parts[1]}`;
        sanitizedResponse.hasEmail = true;
      }
    }

    return res.status(200).json(sanitizedResponse);

  } catch (error) {
    if (isFirebaseAdminCredentialError(error)) {
      return res.status(503).json({ error: 'Serviço temporariamente indisponível.', code: 'FIREBASE_ADMIN_AUTH_FAILED' });
    }
    
    console.error('[Resolve Invite Error]', error);
    return res.status(500).json({ error: 'Erro interno ao resolver convite.' });
  }
}
