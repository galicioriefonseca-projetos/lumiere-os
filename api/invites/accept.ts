import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb, isFirebaseAdminCredentialError } from "../_shared/firebaseAdmin.js";
import { verifyIdToken } from "../_shared/auth.js";

function timestampToMillis(value: any): number {
  if (typeof value === "number") return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
}

export default async function acceptInvite(req: VercelRequest, res: VercelResponse) {
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
    const { inviteId, fullName, phone, primaryFunction, additionalFunctions } = req.body || {};

    if (!inviteId || typeof inviteId !== 'string' || !/^[A-Za-z0-9_-]{5,160}$/.test(inviteId)) {
      return res.status(400).json({ error: 'Convite inválido.' });
    }
    if (!user?.uid || !user?.email) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.length > 160) {
      return res.status(400).json({ error: 'Nome completo inválido.' });
    }

    const adminDb = getAdminDb();
    const now = Date.now();
    let acceptedRole = '';
    let acceptedSalonId = '';

    await adminDb.runTransaction(async (transaction: any) => {
      const inviteRef = adminDb.collection('invites').doc(inviteId);
      const userRef = adminDb.collection('users').doc(user.uid);

      const inviteSnap = await transaction.get(inviteRef);
      if (!inviteSnap.exists) throw new Error('INVITE_NOT_FOUND');
      const inviteData = inviteSnap.data() || {};
      const salonId = String(inviteData.salonId || '');
      if (!/^[A-Za-z0-9_-]{3,128}$/.test(salonId)) throw new Error('INVITE_INVALID');

      const salonRef = adminDb.collection('salons').doc(salonId);
      const userSnap = await transaction.get(userRef);
      const salonSnap = await transaction.get(salonRef);
      if (!salonSnap.exists) throw new Error('SALON_NOT_FOUND');

      if (inviteData.status !== 'pending') throw new Error('INVITE_NOT_PENDING');
      const expiresAtMs = timestampToMillis(inviteData.expiresAt);
      if (expiresAtMs > 0 && now > expiresAtMs) throw new Error('INVITE_EXPIRED');

      const normalizedUserEmail = String(user.email).trim().toLowerCase();
      const invitedEmail = String(inviteData.email || '').trim().toLowerCase();
      if (invitedEmail && invitedEmail !== normalizedUserEmail) throw new Error('INVITE_EMAIL_MISMATCH');

      const existingUser = userSnap.exists ? (userSnap.data() || {}) : {};
      if (existingUser.salonId && existingUser.salonId !== salonId) throw new Error('ALREADY_LINKED_OTHER_SALON');
      if (existingUser.role === 'platform_admin') throw new Error('PRIVILEGED_ACCOUNT');

      const allowedRoles = new Set(['manager', 'receptionist', 'attendant', 'professional']);
      let role = String(inviteData.role || '').trim();
      if (!role && allowedRoles.has(String(inviteData.inviteType || ''))) role = String(inviteData.inviteType);
      if (!allowedRoles.has(role)) throw new Error('INVITE_ROLE_INVALID');

      const isLink = inviteData.inviteType === 'function_link' || inviteData.inviteType === 'team_public_link';
      const currentUses = Number(inviteData.usesCount || 0);
      const maxUses = Number(inviteData.maxUses || 1);
      if (!Number.isInteger(currentUses) || !Number.isInteger(maxUses) || maxUses < 1 || currentUses >= maxUses) {
        throw new Error('INVITE_LIMIT_REACHED');
      }
      const nextUsesCount = currentUses + 1;
      const nextStatus = isLink ? (nextUsesCount >= maxUses ? 'used_limit_reached' : 'pending') : 'accepted';

      transaction.set(userRef, {
        id: user.uid,
        email: normalizedUserEmail,
        role,
        salonId,
        fullName: fullName.trim(),
        name: fullName.trim(),
        phone: typeof phone === 'string' ? phone.trim() : '',
        onboardingStatus: 'completed',
        updatedAt: now,
        ...(userSnap.exists ? {} : { createdAt: now })
      }, { merge: true });

      if (role !== 'manager') {
        const professionalRef = adminDb.collection(`salons/${salonId}/professionals`).doc(user.uid);
        transaction.set(professionalRef, {
          userId: user.uid,
          professionalId: user.uid,
          salonId,
          role,
          name: fullName.trim(),
          email: normalizedUserEmail,
          phone: typeof phone === 'string' ? phone.trim() : '',
          primaryFunction: typeof primaryFunction === 'string' ? primaryFunction.trim() : String(inviteData.professionalFunction || ''),
          additionalFunctions: Array.isArray(additionalFunctions) ? additionalFunctions.filter((item: unknown) => typeof item === 'string').slice(0, 20) : [],
          isActive: true,
          status: 'active',
          joinedByInvite: true,
          inviteId,
          inviteType: inviteData.inviteType,
          createdAt: now,
          updatedAt: now
        }, { merge: true });
      }

      transaction.update(inviteRef, {
        status: nextStatus,
        usesCount: nextUsesCount,
        acceptedByUserId: user.uid,
        usedAt: now,
        updatedAt: now
      });

      acceptedRole = role;
      acceptedSalonId = salonId;
    });

    return res.status(200).json({ success: true, role: acceptedRole, salonId: acceptedSalonId });
  } catch (error: any) {
    if (isFirebaseAdminCredentialError(error)) {
      return res.status(503).json({ error: 'Serviço temporariamente indisponível.', code: 'FIREBASE_ADMIN_AUTH_FAILED' });
    }

    console.error('[Accept Invite Error]', error);
    const code = String(error?.message || '');
    const safeErrors: Record<string, { status: number; message: string }> = {
      INVITE_NOT_FOUND: { status: 404, message: 'Convite não encontrado ou inválido.' },
      INVITE_INVALID: { status: 400, message: 'Convite inválido.' },
      SALON_NOT_FOUND: { status: 404, message: 'Empresa vinculada ao convite não encontrada.' },
      INVITE_NOT_PENDING: { status: 409, message: 'Este convite já foi utilizado ou não está mais ativo.' },
      INVITE_EXPIRED: { status: 410, message: 'Este convite expirou.' },
      INVITE_EMAIL_MISMATCH: { status: 403, message: 'A conta autenticada não corresponde ao e-mail deste convite.' },
      ALREADY_LINKED_OTHER_SALON: { status: 409, message: 'Esta conta já está vinculada a outra empresa.' },
      PRIVILEGED_ACCOUNT: { status: 403, message: 'Esta conta não pode aceitar convites de equipe.' },
      INVITE_ROLE_INVALID: { status: 400, message: 'O convite possui uma função inválida.' },
      INVITE_LIMIT_REACHED: { status: 409, message: 'O limite de uso deste convite foi atingido.' }
    };
    const safe = safeErrors[code] || { status: 500, message: 'Erro interno ao aceitar convite.' };
    return res.status(safe.status).json({ error: safe.message });
  }

}
