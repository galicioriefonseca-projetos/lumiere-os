import { Router } from "express";
import { z } from "zod";
import { getAdminDb, isFirebaseAdminCredentialError } from "../shared/firebaseAdmin.js";
import { resolvePlatformAdmin, verifyIdToken } from "../shared/auth.js";

const router = Router();

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "platform_admin"]);
const MERGE_ALLOWED_ROLES = new Set([
  "owner",
  "admin",
  "manager",
  "receptionist",
  "attendant",
  "platform_admin",
]);

const mergeClientAddressSchema = z
  .object({
    zipCode: z.string().max(24).optional(),
    street: z.string().max(200).optional(),
    number: z.string().max(40).optional(),
    complement: z.string().max(120).optional(),
    neighborhood: z.string().max(120).optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(40).optional(),
  })
  .optional();

const mergeClientsSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX, "salonId inválido"),
  primaryClientId: z.string().regex(SAFE_ID_REGEX, "primaryClientId inválido"),
  secondaryClientId: z.string().regex(SAFE_ID_REGEX, "secondaryClientId inválido"),
  resolvedFields: z.object({
    name: z.string().min(1).max(200),
    phone: z.string().max(60).default(""),
    secondaryPhone: z.string().max(60).optional(),
    email: z.string().max(200).optional(),
    gender: z.string().max(40).optional(),
    birthDate: z.string().max(30).optional(),
    cpf: z.string().max(30).optional(),
    rg: z.string().max(30).optional(),
    notes: z.string().max(4000).optional(),
    address: mergeClientAddressSchema,
  }),
});

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

router.post("/merge", async (req, res) => {
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

    const parsed = mergeClientsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || "Dados inválidos para unificação.",
      });
    }

    const { salonId, primaryClientId, secondaryClientId, resolvedFields } = parsed.data;
    if (primaryClientId === secondaryClientId) {
      return res.status(400).json({ error: "Selecione dois cadastros diferentes para unificar." });
    }

    const uid = String(decoded?.uid || "").trim();
    const userEmail = String(decoded?.email || "").trim().toLowerCase();
    const actorName = String(decoded?.name || userEmail || "Recepção");
    const adminDb = getAdminDb();

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
          MERGE_ALLOWED_ROLES.has(String(uData.role || "").trim())
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
        error: "Você não tem permissão para unificar cadastros deste salão.",
      });
    }

    const primaryRef = adminDb.doc(`salons/${salonId}/clients/${primaryClientId}`);
    const secondaryRef = adminDb.doc(`salons/${salonId}/clients/${secondaryClientId}`);
    const [primarySnap, secondarySnap] = await Promise.all([primaryRef.get(), secondaryRef.get()]);

    if (!primarySnap.exists || !secondarySnap.exists) {
      return res.status(404).json({ error: "Um dos cadastros selecionados não foi encontrado." });
    }

    const primaryData = primarySnap.data() || {};
    const secondaryData = secondarySnap.data() || {};
    const now = Date.now();

    const mergedTags = Array.from(
      new Set([
        ...(Array.isArray(primaryData.tags) ? primaryData.tags : []),
        ...(Array.isArray(secondaryData.tags) ? secondaryData.tags : []),
      ])
    );

    const mergedAnamnese = {
      ...(secondaryData.anamneseResponses || {}),
      ...(primaryData.anamneseResponses || {}),
    };
    const mergedProntuario = {
      ...(secondaryData.prontuarioResponses || {}),
      ...(primaryData.prontuarioResponses || {}),
    };

    const resolvedName = resolvedFields.name.trim();
    const batchOps: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];

    batchOps.push((batch) => {
      batch.set(
        primaryRef,
        {
          name: resolvedName,
          phone: resolvedFields.phone.trim(),
          secondaryPhone: resolvedFields.secondaryPhone?.trim() || "",
          email: resolvedFields.email?.trim() || "",
          gender: resolvedFields.gender?.trim() || "",
          birthDate: resolvedFields.birthDate?.trim() || "",
          cpf: resolvedFields.cpf?.trim() || "",
          rg: resolvedFields.rg?.trim() || "",
          notes: resolvedFields.notes?.trim() || "",
          address: resolvedFields.address || primaryData.address || secondaryData.address || {},
          tags: mergedTags,
          anamneseResponses: mergedAnamnese,
          prontuarioResponses: mergedProntuario,
          lifetimeValue: Number(primaryData.lifetimeValue || 0) + Number(secondaryData.lifetimeValue || 0),
          totalSpent: Number(primaryData.totalSpent || 0) + Number(secondaryData.totalSpent || 0),
          totalAppointments:
            Number(primaryData.totalAppointments || 0) + Number(secondaryData.totalAppointments || 0),
          creditBalance: Number(primaryData.creditBalance || 0) + Number(secondaryData.creditBalance || 0),
          updatedAt: now,
          updatedBy: uid,
        },
        { merge: true }
      );
    });

    const [apptsSnap, comandasSnap, secHistorySnap] = await Promise.all([
      adminDb
        .collection(`salons/${salonId}/appointments`)
        .where("clientId", "==", secondaryClientId)
        .get(),
      adminDb
        .collection(`salons/${salonId}/comandas`)
        .where("clientId", "==", secondaryClientId)
        .get(),
      adminDb
        .collection(`salons/${salonId}/clients/${secondaryClientId}/history`)
        .get()
        .catch(() => null),
    ]);

    apptsSnap.forEach((docSnap) => {
      batchOps.push((batch) => {
        batch.update(docSnap.ref, {
          clientId: primaryClientId,
          clientName: resolvedName,
          updatedAt: now,
        });
      });
    });

    comandasSnap.forEach((docSnap) => {
      batchOps.push((batch) => {
        batch.update(docSnap.ref, {
          clientId: primaryClientId,
          clientName: resolvedName,
          updatedAt: now,
        });
      });
    });

    if (secHistorySnap && !secHistorySnap.empty) {
      secHistorySnap.forEach((histDoc) => {
        const copiedRef = adminDb
          .collection(`salons/${salonId}/clients/${primaryClientId}/history`)
          .doc(`merged_${histDoc.id}`);
        batchOps.push((batch) => {
          batch.set(copiedRef, {
            ...histDoc.data(),
            id: copiedRef.id,
          });
        });
      });
    }

    const mergeLogRef = adminDb
      .collection(`salons/${salonId}/clients/${primaryClientId}/history`)
      .doc();
    batchOps.push((batch) => {
      batch.set(mergeLogRef, {
        id: mergeLogRef.id,
        type: "data_updated",
        title: "Cadastros Unificados",
        description: `Perfil secundário "${secondaryData.name || secondaryClientId}" unificado neste cadastro (${apptsSnap.size} agendamento(s) e ${comandasSnap.size} comanda(s) migrados).`,
        createdBy: uid,
        createdByName: actorName,
        createdAt: now,
      });
    });

    batchOps.push((batch) => {
      batch.update(secondaryRef, {
        deletedAt: now,
        archived: true,
        status: "inactive",
        mergedIntoClientId: primaryClientId,
        updatedAt: now,
        updatedBy: uid,
      });
    });

    const CHUNK_SIZE = 400;
    for (let i = 0; i < batchOps.length; i += CHUNK_SIZE) {
      const chunk = batchOps.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();
      chunk.forEach((fn) => fn(batch));
      await batch.commit();
    }

    return res.json({
      success: true,
      primaryClientId,
      secondaryClientId,
      migratedAppointments: apptsSnap.size,
      migratedComandas: comandasSnap.size,
    });
  } catch (err: any) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({
        error: "Admin SDK indisponível neste ambiente.",
        code: "ADMIN_UNAVAILABLE",
      });
    }
    console.error("[Clients Merge API] Erro:", err);
    return res.status(500).json({
      error: err?.message || "Erro interno ao unificar cadastros.",
    });
  }
});

export const clientsRoutes = router;

