import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb, isFirebaseAdminCredentialError } from "../_shared/firebaseAdmin.js";
import { verifyIdToken } from "../_shared/auth.js";

export default async function acceptInvite(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const user = await verifyIdToken(req);

    const { inviteId, fullName, phone, primaryFunction, additionalFunctions } = req.body;

    if (!inviteId || typeof inviteId !== 'string') {
      return res.status(400).json({ error: 'Convite ID é obrigatório.' });
    }

    const adminDb = getAdminDb();
    
    await adminDb.runTransaction(async (transaction) => {
      const inviteRef = adminDb.collection("invites").doc(inviteId);
      const inviteSnap = await transaction.get(inviteRef);

      if (!inviteSnap.exists) {
        throw new Error('Convite não encontrado.');
      }

      const inviteData = inviteSnap.data() || {};

      if (inviteData.status !== "pending") {
        throw new Error('Convite já utilizado ou inativo.');
      }

      if (inviteData.expiresAt && typeof inviteData.expiresAt === 'number' && Date.now() > inviteData.expiresAt) {
        throw new Error('Convite expirado.');
      }

      if (inviteData.email && inviteData.email.toLowerCase() !== user.email?.toLowerCase()) {
        throw new Error('O e-mail do usuário não corresponde ao convite.');
      }

      const isLink = inviteData.inviteType === 'function_link' || inviteData.inviteType === 'team_public_link';
      
      let nextUsesCount = (inviteData.usesCount || 0) + 1;
      let nextStatus = "accepted";
      
      if (isLink) {
        const maxUses = inviteData.maxUses || 1;
        if ((inviteData.usesCount || 0) >= maxUses) {
          throw new Error('O limite de uso deste convite foi atingido.');
        }
        if (nextUsesCount >= maxUses) {
          nextStatus = "used_limit_reached";
        } else {
          nextStatus = "pending";
        }
      }

      let determinedRole = inviteData.role;
      if (determinedRole === 'platform_admin' || determinedRole === 'owner' || determinedRole === 'admin') {
         throw new Error('Este convite não pode conceder nível administrativo superior.');
      }
      
      if (!determinedRole && (inviteData.inviteType === 'manager' || inviteData.inviteType === 'receptionist' || inviteData.inviteType === 'attendant' || inviteData.inviteType === 'professional')) {
          determinedRole = inviteData.inviteType;
      }
      
      if (!determinedRole) {
          determinedRole = "professional"; // Fallback safe
      }

      // Update User
      const userRef = adminDb.collection("users").doc(user.uid);
      transaction.set(userRef, {
        role: determinedRole,
        salonId: inviteData.salonId,
        fullName: fullName || user.name || "",
        phone: phone || "",
        updatedAt: Date.now()
      }, { merge: true });

      // Create Professional if appropriate
      if (determinedRole !== 'manager') {
        const professionalRef = adminDb.collection(`salons/${inviteData.salonId}/professionals`).doc(user.uid);
        transaction.set(professionalRef, {
          userId: user.uid,
          name: fullName || user.name || "",
          email: user.email,
          phone: phone || "",
          primaryFunction: primaryFunction || inviteData.professionalFunction || "",
          additionalFunctions: additionalFunctions || [],
          isActive: true,
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now()
        }, { merge: true });
      }

      // Update Invite
      transaction.update(inviteRef, {
        status: nextStatus,
        usesCount: nextUsesCount,
        acceptedByUserId: user.uid,
        usedAt: Date.now(),
        updatedAt: Date.now()
      });
    });

    return res.status(200).json({ success: true, message: 'Convite aceito com sucesso.' });

  } catch (error: any) {
    if (isFirebaseAdminCredentialError(error)) {
      return res.status(503).json({ error: 'Serviço temporariamente indisponível.', code: 'FIREBASE_ADMIN_AUTH_FAILED' });
    }
    
    console.error('[Accept Invite Error]', error);
    
    // Evitar expor stack trace, mas mostrar a mensagem caso venha da transaction throw.
    const message = error.message && typeof error.message === 'string' && 
                    !error.message.includes('firebase') && 
                    !error.message.includes('14 UNAVAILABLE')
                    ? error.message 
                    : 'Erro interno ao aceitar convite.';
                    
    return res.status(400).json({ error: message });
  }
}
