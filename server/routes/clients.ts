import { Router } from "express";
import { getAdminDb, isFirebaseAdminCredentialError } from "../shared/firebaseAdmin.js";
import { resolvePlatformAdmin, verifyIdToken } from "../shared/auth.js";

const router = Router();

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "platform_admin"]);

router.post("/bulk-delete", async (req, res) => {
  try {
    let decoded: any;
    try {
      decoded = await verifyIdToken(req);
    } catch (authErr: any) {
      if (isFirebaseAdminCredentialError(authErr)) {
        return res.status(503).json({
          error: "Admin SDK indisponível neste ambiente.",
          code: "ADMIN_UNAVAILABLE",
        });
      }
      return res.status(401).json({
        error: authErr?.message || "Autenticação inválida.",
      });
    }

    const uid = String(decoded?.uid || "").trim();
    const userEmail = String(decoded?.email || "").trim().toLowerCase();
    const salonId = String(req.body?.salonId || "").trim();
    const rawClientIds = Array.isArray(req.body?.clientIds) ? req.body.clientIds : [];
    const clientIds: string[] = Array.from(
      new Set(
        rawClientIds
          .map((id: unknown) => String(id || "").trim())
          .filter((id: string) => id.length > 0 && SAFE_ID_REGEX.test(id))
      )
    );

    if (!salonId || !SAFE_ID_REGEX.test(salonId)) {
      return res.status(400).json({ error: "salonId inválido." });
    }
    if (clientIds.length === 0) {
      return res.status(400).json({ error: "Nenhum contato válido informado para exclusão." });
    }
    if (clientIds.length > 2000) {
      return res.status(400).json({ error: "Limite de 2000 contatos por solicitação." });
    }

    const adminDb = getAdminDb();

    // Verify authorization: platform_admin OR salon owner/manager
    let authorized = await resolvePlatformAdmin(decoded, adminDb);

    if (!authorized) {
      const [userSnap, salonSnap] = await Promise.all([
        adminDb.collection("users").doc(uid).get(),
        adminDb.collection("salons").doc(salonId).get(),
      ]);

      if (userSnap.exists) {
        const uData = userSnap.data() || {};
        if (
          uData.salonId === salonId &&
          ALLOWED_ROLES.has(String(uData.role || "").trim())
        ) {
          authorized = true;
        }
      }

      if (!authorized && salonSnap.exists) {
        const sData = salonSnap.data() || {};
        if (
          sData.ownerId === uid ||
          (userEmail &&
            typeof sData.ownerEmail === "string" &&
            sData.ownerEmail.trim().toLowerCase() === userEmail)
        ) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return res.status(403).json({
        error: "Você não tem permissão para apagar contatos deste salão.",
      });
    }

    // Delete client documents and their history subcollections in batches
    const refsToDelete: FirebaseFirestore.DocumentReference[] = [];
    const CONCURRENCY = 20;

    for (let i = 0; i < clientIds.length; i += CONCURRENCY) {
      const pool = clientIds.slice(i, i + CONCURRENCY);
      const histSnapshots = await Promise.all(
        pool.map((clientId) =>
          adminDb
            .collection(`salons/${salonId}/clients/${clientId}/history`)
            .get()
            .catch(() => null)
        )
      );

      pool.forEach((clientId, idx) => {
        const histSnap = histSnapshots[idx];
        if (histSnap && !histSnap.empty) {
          histSnap.forEach((docSnap) => refsToDelete.push(docSnap.ref));
        }
        refsToDelete.push(adminDb.doc(`salons/${salonId}/clients/${clientId}`));
      });
    }

    const CHUNK_SIZE = 400;
    for (let i = 0; i < refsToDelete.length; i += CHUNK_SIZE) {
      const chunk = refsToDelete.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    return res.json({
      success: true,
      deletedClients: clientIds.length,
      deletedOps: refsToDelete.length,
    });
  } catch (err: any) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({
        error: "Admin SDK indisponível neste ambiente.",
        code: "ADMIN_UNAVAILABLE",
      });
    }
    console.error("[Clients Bulk Delete API] Erro:", err);
    return res.status(500).json({
      error: err?.message || "Erro interno ao excluir contatos.",
    });
  }
});

export const clientsRoutes = router;
