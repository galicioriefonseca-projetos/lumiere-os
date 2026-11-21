import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  getAdminDb,
  isFirebaseAdminCredentialError,
} from "../shared/firebaseAdmin.js";
import { verifyIdToken, resolvePlatformAdmin } from "../shared/auth.js";
import { adminLimiter } from "../middleware/rateLimiter.js";

const router = Router();

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

const MANAGEMENT_ROLES = new Set(["owner", "admin", "manager", "platform_admin"]);
const FRONTDESK_ROLES = new Set([
  "owner",
  "admin",
  "manager",
  "receptionist",
  "attendant",
  "platform_admin",
]);

interface AuthContext {
  uid: string;
  email: string;
  name: string;
  role: string;
}

async function authorizeSalonAccess(
  req: Request,
  salonId: string,
  allowedRoles: Set<string>
): Promise<{ ok: true; ctx: AuthContext } | { ok: false; status: number; error: string }> {
  let decoded: {
    uid?: string;
    email?: string;
    name?: string;
    role?: string;
    platform_admin?: boolean;
  };
  try {
    decoded = (await verifyIdToken(req)) as {
      uid?: string;
      email?: string;
      name?: string;
      role?: string;
      platform_admin?: boolean;
    };
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return {
        ok: false,
        status: 503,
        error: "Serviço administrativo indisponível neste ambiente.",
      };
    }
    const message = err instanceof Error ? err.message : "Token de autenticação inválido.";
    return { ok: false, status: 401, error: message };
  }

  const uid = String(decoded.uid || "").trim();
  const email = String(decoded.email || "").trim().toLowerCase();
  const adminDb = getAdminDb();

  const isMaster = await resolvePlatformAdmin(decoded, adminDb);
  if (isMaster) {
    return {
      ok: true,
      ctx: {
        uid,
        email,
        name: String(decoded.name || email || "Administrador"),
        role: "platform_admin",
      },
    };
  }

  if (salonId === "tutorial_lumiere_studio") {
    return {
      ok: true,
      ctx: {
        uid,
        email,
        name: String(decoded.name || email || "Demo Owner"),
        role: "owner",
      },
    };
  }

  const [userSnap, salonSnap] = await Promise.all([
    adminDb.collection("users").doc(uid).get(),
    adminDb.collection("salons").doc(salonId).get(),
  ]);

  const sData = salonSnap.exists ? salonSnap.data() || {} : {};
  const isOwner =
    sData.ownerId === uid ||
    (Boolean(email) &&
      typeof sData.ownerEmail === "string" &&
      sData.ownerEmail.trim().toLowerCase() === email);

  const uData = userSnap.exists ? userSnap.data() || {} : {};
  const displayName = String(uData.fullName || decoded.name || email || "Operador");

  if (isOwner) {
    return {
      ok: true,
      ctx: { uid, email, name: displayName, role: "owner" },
    };
  }

  const userRole = String(uData.role || "").trim();
  if (uData.salonId !== salonId) {
    return { ok: false, status: 403, error: "Acesso negado para este estabelecimento." };
  }

  if (!allowedRoles.has(userRole)) {
    return {
      ok: false,
      status: 403,
      error: "Seu perfil não possui permissão para realizar esta operação financeira.",
    };
  }

  return {
    ok: true,
    ctx: { uid, email, name: displayName, role: userRole },
  };
}

const comandaItemSchema = z.object({
  type: z.enum(["service", "product", "package"]),
  id: z.string().min(1).max(160),
  name: z.string().min(1).max(200),
  quantity: z.number().min(0.01).max(1000).optional(),
  unitPrice: z.number().min(0).max(1000000).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  price: z.number().min(0).max(10000000),
  professionalId: z.string().min(1).max(160),
  professionalName: z.string().min(1).max(160),
  appointmentId: z.string().max(160).optional(),
});

const paymentSplitSchema = z.object({
  id: z.string().min(1).max(80),
  method: z.enum(["pix", "credit_card", "debit_card", "cash", "transfer", "client_credit", "other"]),
  amount: z.number().min(0).max(10000000),
  info: z.string().max(200).optional(),
});

const finalizeComandaSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX, "salonId inválido"),
  comandaId: z.string().regex(SAFE_ID_REGEX, "comandaId inválido"),
  clientId: z.string().min(1).max(160),
  clientName: z.string().min(1).max(200),
  items: z.array(comandaItemSchema).min(1, "A comanda precisa ter ao menos 1 item."),
  paymentSplits: z.array(paymentSplitSchema).default([]),
  cashRegisterName: z.string().max(120).default("Caixa Principal"),
  discountAmount: z.number().min(0).max(10000000).default(0),
  chargesAmount: z.number().min(0).max(10000000).default(0),
  saveDifferenceToClientBalance: z.boolean().default(false),
  prontuarioNotes: z.string().max(4000).optional(),
  notes: z.string().max(1000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  cash: "Dinheiro",
  transfer: "Transferência",
  client_credit: "Saldo do Cliente",
  other: "Outro",
};

router.post("/comandas/finalize", adminLimiter, async (req: Request, res: Response) => {
  const parsed = finalizeComandaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Dados inválidos para finalizar comanda.",
    });
  }

  const input = parsed.data;
  const auth = await authorizeSalonAccess(req, input.salonId, FRONTDESK_ROLES);
  if ("error" in auth) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const adminDb = getAdminDb();
    const now = Date.now();
    const todayStr = input.date || new Date().toISOString().substring(0, 10);
    const timeStr = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const comandaRef = adminDb.doc(`salons/${input.salonId}/comandas/${input.comandaId}`);
    const comandaSnap = await comandaRef.get();
    if (!comandaSnap.exists) {
      return res.status(404).json({ error: "Comanda não encontrada." });
    }
    const existingComanda = comandaSnap.data() || {};
    if (existingComanda.status === "completed") {
      return res.status(409).json({ error: "Esta comanda já foi finalizada." });
    }

    const subtotal = input.items.reduce((sum, itm) => sum + Number(itm.price || 0), 0);
    const servicesTotal = input.items
      .filter((i) => i.type === "service" || i.type === "package")
      .reduce((sum, itm) => sum + Number(itm.price || 0), 0);
    const productsTotal = input.items
      .filter((i) => i.type === "product")
      .reduce((sum, itm) => sum + Number(itm.price || 0), 0);

    const finalTotal = Math.max(0, subtotal - input.discountAmount + input.chargesAmount);
    const validSplits = input.paymentSplits.filter((s) => s.amount > 0);
    const paidAmount = validSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const difference = paidAmount - finalTotal; // positive = troco/crédito, negative = dívida
    const clientBalanceDelta = input.saveDifferenceToClientBalance ? difference : 0;

    const comandaNum =
      typeof existingComanda.comandaNumber === "number"
        ? existingComanda.comandaNumber
        : Math.floor(100 + (now % 9000));

    const batch = adminDb.batch();

    // 1. Update Comanda document (keep record for history / Comandas Finalizadas)
    const primaryMethod = validSplits[0]?.method || "pix";
    batch.set(
      comandaRef,
      {
        clientId: input.clientId,
        clientName: input.clientName,
        status: "completed",
        comandaNumber: comandaNum,
        items: input.items,
        totalAmount: subtotal,
        servicesTotal,
        productsTotal,
        discount: input.discountAmount,
        charges: input.chargesAmount,
        finalTotal,
        paidAmount,
        clientBalanceDelta,
        paymentSplits: validSplits,
        paymentMethod: primaryMethod,
        cashRegisterName: input.cashRegisterName || "Caixa Principal",
        prontuarioNotes: input.prontuarioNotes || existingComanda.prontuarioNotes || "",
        notes: input.notes || existingComanda.notes || "",
        closedAt: now,
        closedByName: auth.ctx.name,
        updatedByName: auth.ctx.name,
        updatedAt: now,
      },
      { merge: true }
    );

    // 2. Create or complete appointments per item so Commissions / Goals / Analytics stay accurate
    for (const item of input.items) {
      const proportion = subtotal > 0 ? item.price / subtotal : 0;
      const itemDiscount = input.discountAmount * proportion;
      const itemNetPrice = Math.max(0, Number((item.price - itemDiscount).toFixed(2)));

      if (item.appointmentId && SAFE_ID_REGEX.test(item.appointmentId)) {
        const linkedAppRef = adminDb.doc(
          `salons/${input.salonId}/appointments/${item.appointmentId}`
        );
        batch.set(
          linkedAppRef,
          {
            status: "completed",
            price: itemNetPrice,
            paymentMethod: primaryMethod,
            comandaId: input.comandaId,
            updatedAt: now,
          },
          { merge: true }
        );
      } else {
        const appRef = adminDb.collection(`salons/${input.salonId}/appointments`).doc();
        batch.set(appRef, {
          id: appRef.id,
          clientId: input.clientId,
          clientName: input.clientName,
          professionalId: item.professionalId,
          professionalName: item.professionalName,
          serviceId: item.id,
          serviceName: item.name,
          price: itemNetPrice,
          type: item.type === "product" ? "product" : "service",
          date: todayStr,
          time: timeStr,
          status: "completed",
          paymentMethod: primaryMethod,
          comandaId: input.comandaId,
          isManualLaunch: false,
          notes: `Comanda #${comandaNum}${input.notes ? ` · ${input.notes}` : ""}`,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 3. Create Financial Transactions (Entradas) per split
    const splitsToRecord =
      validSplits.length > 0
        ? validSplits
        : finalTotal > 0
          ? [{ id: "auto", method: "pix" as const, amount: finalTotal, info: "" }]
          : [];

    for (const split of splitsToRecord) {
      const finRef = adminDb.collection(`salons/${input.salonId}/financialTransactions`).doc();
      batch.set(finRef, {
        id: finRef.id,
        description: `Comanda #${comandaNum} - ${input.clientName}${split.info ? ` (${split.info})` : ""}`,
        amount: Number(split.amount.toFixed(2)),
        type: "revenue",
        category: productsTotal > servicesTotal ? "Revenda de Produtos" : "Serviços",
        date: todayStr,
        status: "paid",
        paymentMethod: METHOD_LABEL[split.method] || "Pix",
        cashRegisterName: input.cashRegisterName || "Caixa Principal",
        comandaId: input.comandaId,
        comandaNumber: comandaNum,
        createdByName: auth.ctx.name,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 4. Update Client balance & Prontuário history when registered client
    if (input.clientId && input.clientId !== "consumidor-final" && SAFE_ID_REGEX.test(input.clientId)) {
      const clientRef = adminDb.doc(`salons/${input.salonId}/clients/${input.clientId}`);
      const clientSnap = await clientRef.get();
      if (clientSnap.exists) {
        const cData = clientSnap.data() || {};
        const prevBalance = Number(cData.creditBalance || 0);
        const usedCredit = validSplits
          .filter((s) => s.method === "client_credit")
          .reduce((acc, s) => acc + s.amount, 0);
        const nextBalance = Number((prevBalance - usedCredit + clientBalanceDelta).toFixed(2));
        const prevSpent = Number(cData.totalSpent || 0);

        batch.set(
          clientRef,
          {
            creditBalance: nextBalance,
            totalSpent: Number((prevSpent + finalTotal).toFixed(2)),
            updatedAt: now,
          },
          { merge: true }
        );

        if (input.prontuarioNotes && input.prontuarioNotes.trim().length > 0) {
          const histRef = adminDb
            .collection(`salons/${input.salonId}/clients/${input.clientId}/history`)
            .doc();
          batch.set(histRef, {
            id: histRef.id,
            type: "note_added",
            title: `Prontuário técnico · Comanda #${comandaNum}`,
            description: input.prontuarioNotes.trim(),
            createdBy: auth.ctx.uid,
            createdByName: auth.ctx.name,
            createdAt: now,
          });
        }
      }
    }

    await batch.commit();

    return res.status(200).json({
      success: true,
      comandaId: input.comandaId,
      comandaNumber: comandaNum,
      finalTotal,
      paidAmount,
    });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({
        error: "Admin SDK indisponível neste ambiente.",
        code: "ADMIN_UNAVAILABLE",
      });
    }
    console.error("[Operations] Erro ao finalizar comanda:", err);
    return res.status(500).json({ error: "Erro interno ao finalizar comanda." });
  }
});

const reopenComandaSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  comandaId: z.string().regex(SAFE_ID_REGEX),
});

router.post("/comandas/reopen", adminLimiter, async (req: Request, res: Response) => {
  const parsed = reopenComandaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos para reabrir comanda." });
  }

  const { salonId, comandaId } = parsed.data;
  const auth = await authorizeSalonAccess(req, salonId, MANAGEMENT_ROLES);
  if ("error" in auth) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const adminDb = getAdminDb();
    const comandaRef = adminDb.doc(`salons/${salonId}/comandas/${comandaId}`);
    const snap = await comandaRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Comanda não encontrada." });
    }

    await comandaRef.set(
      {
        status: "checkout_pending",
        updatedByName: auth.ctx.name,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    return res.status(200).json({ success: true });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({
        error: "Admin SDK indisponível neste ambiente.",
        code: "ADMIN_UNAVAILABLE",
      });
    }
    console.error("[Operations] Erro ao reabrir comanda:", err);
    return res.status(500).json({ error: "Erro interno ao reabrir comanda." });
  }
});

const payBatchSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.string().min(1).max(60),
  cashRegisterName: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        professionalId: z.string().min(1).max(160),
        professionalName: z.string().min(1).max(160),
        role: z.string().max(80).optional(),
        rateioAmount: z.number().min(0),
        bonusAmount: z.number().min(0),
        discountAmount: z.number().min(0),
        netAmount: z.number().min(0.01),
        adjustmentsAppliedIds: z.array(z.string()).default([]),
      })
    )
    .min(1, "Selecione ao menos um profissional para pagar."),
});

router.post("/commissions/pay-batch", adminLimiter, async (req: Request, res: Response) => {
  const parsed = payBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Dados inválidos para pagamento de comissões.",
    });
  }

  const input = parsed.data;
  const auth = await authorizeSalonAccess(req, input.salonId, MANAGEMENT_ROLES);
  if ("error" in auth) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const adminDb = getAdminDb();
    const now = Date.now();
    const todayStr = new Date().toISOString().substring(0, 10);
    const totalAmount = Number(
      input.items.reduce((sum, i) => sum + Number(i.netAmount || 0), 0).toFixed(2)
    );

    const payoutRef = adminDb.collection(`salons/${input.salonId}/commissionPayouts`).doc();
    const batch = adminDb.batch();

    batch.set(payoutRef, {
      id: payoutRef.id,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      paymentMethod: input.paymentMethod,
      cashRegisterName: input.cashRegisterName || "Caixa Principal",
      notes: input.notes || "",
      totalAmount,
      professionalsCount: input.items.length,
      items: input.items,
      paidByName: auth.ctx.name,
      paidAt: now,
      createdAt: now,
    });

    // Mark included adjustments as settled
    for (const item of input.items) {
      for (const adjId of item.adjustmentsAppliedIds) {
        if (SAFE_ID_REGEX.test(adjId)) {
          const adjRef = adminDb.doc(
            `salons/${input.salonId}/commissionAdjustments/${adjId}`
          );
          batch.set(
            adjRef,
            {
              status: "settled",
              payoutId: payoutRef.id,
              updatedAt: now,
            },
            { merge: true }
          );
        }
      }
    }

    // Record paid commission expense in Financeiro
    const namesPreview =
      input.items.length === 1
        ? input.items[0].professionalName
        : `${input.items.length} profissionais`;

    const finRef = adminDb.collection(`salons/${input.salonId}/financialTransactions`).doc();
    batch.set(finRef, {
      id: finRef.id,
      description: `Repasse de Comissões (${namesPreview}) · ${input.periodStart} a ${input.periodEnd}`,
      amount: totalAmount,
      type: "expense",
      category: "Comissões",
      date: todayStr,
      status: "paid",
      paymentMethod: input.paymentMethod,
      cashRegisterName: input.cashRegisterName || "Caixa Principal",
      payoutId: payoutRef.id,
      createdByName: auth.ctx.name,
      createdAt: now,
      updatedAt: now,
    });

    await batch.commit();

    return res.status(200).json({
      success: true,
      payoutId: payoutRef.id,
      totalAmount,
    });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({
        error: "Admin SDK indisponível neste ambiente.",
        code: "ADMIN_UNAVAILABLE",
      });
    }
    console.error("[Operations] Erro ao pagar comissões em lote:", err);
    return res.status(500).json({ error: "Erro interno ao registrar pagamento de comissões." });
  }
});

export { router as operationsRoutes };
