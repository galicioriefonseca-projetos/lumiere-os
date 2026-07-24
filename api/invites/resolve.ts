import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb, isFirebaseAdminCredentialError } from "../_shared/firebaseAdmin.js";

function timestampToMillis(value: any): number {
  if (typeof value === "number") return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
}

export default async function resolveInvite(req: VercelRequest, res: VercelResponse) {
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

    if (!inviteId || typeof inviteId !== 'string' || !/^[A-Za-z0-9_-]{5,160}$/.test(inviteId)) {
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
    const expiresAtMs = timestampToMillis(inviteData.expiresAt);
    if (expiresAtMs > 0 && Date.now() > expiresAtMs) {
      return res.status(410).json({ error: 'Este convite está expirado.' });
    }
    
    // Use count validation for link types
    if (inviteData.inviteType === 'function_link' || inviteData.inviteType === 'team_public_link') {
      if (inviteData.usesCount !== undefined && inviteData.maxUses !== undefined) {
        if (inviteData.usesCount >= inviteData.maxUses) {
          return res.status(400).json({ error: 'O limite de uso deste convite foi atingido.' });
        }
      }
    }

    const salonId = String(inviteData.salonId || "");
    if (!/^[A-Za-z0-9_-]{3,128}$/.test(salonId)) {
      return res.status(404).json({ error: 'Convite não encontrado ou inválido.' });
    }
    const salonSnap = await adminDb.collection("salons").doc(salonId).get();
    if (!salonSnap.exists) {
      return res.status(404).json({ error: 'Convite não encontrado ou inválido.' });
    }

    // Somente dados sanitizados necessários para a tela.
    const sanitizedResponse: any = {
      inviteId: inviteSnap.id,
      inviteType: inviteData.inviteType,
      role: inviteData.role,
      category: inviteData.category || '',
      specialty: inviteData.specialty || '',
      professionalFunction: inviteData.professionalFunction || '',
      salonName: String(salonSnap.data()?.name || 'Empresa LumièreOS')
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
