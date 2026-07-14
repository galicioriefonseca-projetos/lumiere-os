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

export async function canManageBilling(
  user: any,
  salonId: string,
  salonData: any
): Promise<{ authorized: boolean; role?: string; reason?: string }> {
  const uid = user?.uid;
  const email = user?.email;

  if (!uid) {
    return { authorized: false, reason: "ID de usuário ausente." };
  }

  // 1. Proprietário direto do salão no Firestore (salonData.ownerId)
  if (salonData?.ownerId === uid) {
    return { authorized: true, role: "owner" };
  }

  // 2. Platform Admin via e-mail configurado ou na coleção platformAdmins
  const platformAdminEmail =
    process.env.VITE_PLATFORM_ADMIN_EMAIL ||
    process.env.PLATFORM_ADMIN_EMAIL ||
    "admin@lumiereos.com";
  if (email && (email === platformAdminEmail || email === "galicioriefonseca@gmail.com")) {
    return { authorized: true, role: "platform_admin" };
  }

  const adminDb = getAdminDb();

  try {
    const platformAdminSnap = await adminDb
      .collection("platformAdmins")
      .doc(uid)
      .get();
    if (platformAdminSnap.exists) {
      return { authorized: true, role: "platform_admin" };
    }
  } catch (err) {
    console.warn(`[Billing Auth] Erro ao consultar platformAdmins/${uid}:`, err);
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
