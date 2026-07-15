import { getAdminAuth, getAdminDb } from "./firebaseAdmin.js";

export async function verifyIdToken(req: any): Promise<any> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Autenticação requerida (Token ausente).");
  }
  const token = authHeader.split("Bearer ")[1];
  const adminAuth = getAdminAuth();
  const decodedToken = await adminAuth.verifyIdToken(token);
  return decodedToken;
}

export async function resolvePlatformAdmin(user: any, adminDb: any): Promise<boolean> {
  if (!user || !user.uid) return false;

  // 1. Custom Claims
  if (user.role === "platform_admin") return true;
  if (user.platform_admin === true) return true;

  // 2. platformAdmins/{uid}
  try {
    const platformAdminSnap = await adminDb.collection("platformAdmins").doc(user.uid).get();
    if (platformAdminSnap.exists) return true;
  } catch (err) {
    console.warn(`[Platform Admin] Erro ao consultar platformAdmins/${user.uid}:`, err);
  }

  // 3. users/{uid}.role === "platform_admin"
  try {
    const userSnap = await adminDb.collection("users").doc(user.uid).get();
    if (userSnap.exists) {
      const uData = userSnap.data();
      if (uData?.role === "platform_admin") {
        return true;
      }
    }
  } catch (err) {
    console.warn(`[Platform Admin] Erro ao consultar users/${user.uid}:`, err);
  }

  // 4. Fallback PLATFORM_ADMIN_EMAIL (temporário, sem VITE_*)
  const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL;
  if (user.email && platformAdminEmail && user.email === platformAdminEmail) {
    return true;
  }

  return false;
}

export async function canManageBilling(
  user: any,
  salonId: string,
  salonData: any
): Promise<{ authorized: boolean; role?: string; reason?: string }> {
  const uid = user?.uid;

  if (!uid) {
    return { authorized: false, reason: "ID de usuário ausente." };
  }

  const adminDb = getAdminDb();

  // 1. Primeiro resolve platform admin globalmente
  const platformAdmin = await resolvePlatformAdmin(user, adminDb);
  if (platformAdmin) {
    return { authorized: true, role: "platform_admin" };
  }

  // 2. Proprietário direto do salão no Firestore (salonData.ownerId)
  if (salonData?.ownerId === uid) {
    return { authorized: true, role: "owner" };
  }

  // 3. Usuário registrado com role autorizada ("owner", "admin", "manager") associada ao salão correspondente
  try {
    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (userSnap.exists) {
      const uData = userSnap.data();
      const userSalonId = uData?.salonId;
      const userRole = uData?.role;

      if (userSalonId === salonId) {
        const allowedRoles = ["owner", "admin", "manager"];
        if (allowedRoles.includes(userRole)) {
          return { authorized: true, role: userRole };
        } else {
          return {
            authorized: false,
            role: userRole,
            reason: `Seu perfil (${userRole}) não possui permissão de faturamento.`,
          };
        }
      }
    }
  } catch (err) {
    console.error(
      `[Billing Auth] Erro ao consultar documento do usuário users/${uid}:`,
      err
    );
  }

  return {
    authorized: false,
    reason: "Você não tem permissão para gerenciar o faturamento deste salão.",
  };
}
