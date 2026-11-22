import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  getAdminDb,
  isFirebaseAdminCredentialError,
} from "../shared/firebaseAdmin.js";
import { verifyIdToken, resolvePlatformAdmin } from "../shared/auth.js";
import { adminLimiter } from "../middleware/rateLimiter.js";
import { parseBrazilianNfeXml } from "../../src/utils/nfeParser.js";

const router = Router();
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

const MANAGEMENT_ROLES = new Set(["owner", "admin", "manager", "platform_admin"]);

interface AuthContext {
  uid: string;
  email: string;
  name: string;
  role: string;
}

async function authorizeInventoryAccess(
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
      error: "Seu perfil não possui permissão para gerenciar o estoque.",
    };
  }

  return {
    ok: true,
    ctx: { uid, email, name: displayName, role: userRole },
  };
}

const stockMovementSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  productId: z.string().regex(SAFE_ID_REGEX),
  direction: z.enum(["in", "out"]),
  quantity: z.number().positive("Quantidade deve ser maior que zero.").max(100000),
  movementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().min(2, "Observação é obrigatória.").max(500),
  unitCost: z.number().min(0).max(1000000).optional(),
  expirationDate: z.string().max(20).optional(),
  supplierId: z.string().max(128).optional(),
  supplierName: z.string().max(160).optional(),
  professionalId: z.string().max(128).optional(),
  professionalName: z.string().max(160).optional(),
  recordFinancialExpense: z.boolean().optional(),
});

router.post("/movement", adminLimiter, async (req: Request, res: Response) => {
  const parsed = stockMovementSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Dados inválidos para movimentação de estoque.",
    });
  }

  const input = parsed.data;
  const auth = await authorizeInventoryAccess(req, input.salonId, MANAGEMENT_ROLES);
  if ("error" in auth) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const adminDb = getAdminDb();
    const now = Date.now();
    const productRef = adminDb.doc(`salons/${input.salonId}/inventory/${input.productId}`);
    const productSnap = await productRef.get();
    if (!productSnap.exists) {
      return res.status(404).json({ error: "Produto não encontrado no estoque." });
    }

    const pData = productSnap.data() || {};
    const prevQty = Number(pData.quantity || 0);
    const delta = input.direction === "in" ? input.quantity : -input.quantity;
    const nextQty = Number((prevQty + delta).toFixed(3));

    if (nextQty < 0) {
      return res.status(400).json({
        error: `Estoque insuficiente (${prevQty} disponíveis para saída de ${input.quantity}).`,
      });
    }

    const effectiveUnitCost =
      typeof input.unitCost === "number" && input.unitCost > 0
        ? input.unitCost
        : Number(pData.costPrice || 0);
    const totalCost = Number((effectiveUnitCost * input.quantity).toFixed(2));

    const batch = adminDb.batch();
    const productUpdate: Record<string, unknown> = {
      quantity: nextQty,
      updatedAt: now,
    };
    if (input.direction === "in" && typeof input.unitCost === "number" && input.unitCost > 0) {
      productUpdate.costPrice = input.unitCost;
    }
    if (input.direction === "in" && input.expirationDate) {
      productUpdate.nextExpirationDate = input.expirationDate;
    }
    if (input.direction === "in" && input.supplierName) {
      productUpdate.supplier = input.supplierName;
      if (input.supplierId) productUpdate.supplierId = input.supplierId;
    }

    batch.set(productRef, productUpdate, { merge: true });

    const movRef = adminDb.collection(`salons/${input.salonId}/stockMovements`).doc();
    batch.set(movRef, {
      id: movRef.id,
      salonId: input.salonId,
      productId: input.productId,
      productName: String(pData.name || "Produto"),
      productSku: String(pData.sku || ""),
      type: input.direction,
      quantityDelta: delta,
      previousQuantity: prevQty,
      newQuantity: nextQty,
      unitCost: effectiveUnitCost,
      totalCost,
      reason:
        input.direction === "in"
          ? input.supplierName
            ? `Entrada · ${input.supplierName}`
            : "Entrada manual de estoque"
          : input.professionalName
            ? `Saída para profissional · ${input.professionalName}`
            : "Saída manual de estoque",
      notes: input.notes,
      expirationDate: input.expirationDate || null,
      supplierId: input.supplierId || null,
      supplierName: input.supplierName || null,
      professionalId: input.professionalId || null,
      professionalName: input.professionalName || null,
      movementDate: input.movementDate,
      performedById: auth.ctx.uid,
      performedByName: auth.ctx.name,
      createdAt: now,
    });

    if (input.direction === "in" && input.recordFinancialExpense && totalCost > 0) {
      const finRef = adminDb.collection(`salons/${input.salonId}/financialTransactions`).doc();
      batch.set(finRef, {
        id: finRef.id,
        description: `Compra Estoque: ${String(pData.name || "Produto")} (${input.quantity}x)`,
        amount: totalCost,
        type: "expense",
        category: "Compra de Estoque",
        date: input.movementDate,
        status: "paid",
        paymentMethod: "Pix / Transferência",
        cashRegisterName: "Caixa Principal",
        createdByName: auth.ctx.name,
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
    return res.status(200).json({ success: true, newQuantity: nextQty, movementId: movRef.id });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({
        error: "Admin SDK indisponível neste ambiente.",
        code: "ADMIN_UNAVAILABLE",
      });
    }
    console.error("[Inventory] Erro na movimentação:", err);
    return res.status(500).json({ error: "Erro interno ao registrar movimentação." });
  }
});

const parseNfeSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  xmlContent: z.string().min(50, "Arquivo XML vazio ou incompleto.").max(3_000_000, "XML excede o tamanho máximo de 3MB."),
});

router.post("/nfe-parse", adminLimiter, async (req: Request, res: Response) => {
  const parsed = parseNfeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "XML inválido.",
    });
  }

  const auth = await authorizeInventoryAccess(req, parsed.data.salonId, MANAGEMENT_ROLES);
  if ("error" in auth) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const invoice = parseBrazilianNfeXml(parsed.data.xmlContent);
    return res.status(200).json({ success: true, invoice });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Não foi possível interpretar o XML da NF-e.";
    return res.status(400).json({ error: msg });
  }
});

const receiveOrderItemSchema = z.object({
  id: z.string().min(1).max(160),
  productId: z.string().max(160).optional(),
  productName: z.string().min(1).max(220),
  sku: z.string().max(120).optional(),
  barcode: z.string().max(120).optional(),
  brand: z.string().max(120).optional(),
  category: z.string().max(120).optional(),
  stockLocation: z.enum(["resale", "internal_use", "warehouse", "mixed"]).optional(),
  quantity: z.number().positive().max(100000),
  unitCost: z.number().min(0).max(1000000),
  totalCost: z.number().min(0).max(100000000),
  expirationDate: z.string().max(20).optional(),
  createNewProduct: z.boolean().optional(),
});

const receiveOrderSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  orderId: z.string().max(160).optional(),
  orderNumber: z.string().min(1).max(80),
  supplierId: z.string().max(160).optional(),
  supplierName: z.string().min(1).max(200),
  supplierDocument: z.string().max(40).optional(),
  createSupplierPayload: z
    .object({
      tradeName: z.string().min(1).max(200),
      companyName: z.string().max(200).optional(),
      document: z.string().max(40).optional(),
      phone: z.string().max(40).optional(),
      zipCode: z.string().max(20).optional(),
      state: z.string().max(10).optional(),
      city: z.string().max(120).optional(),
      address: z.string().max(220).optional(),
      number: z.string().max(40).optional(),
      neighborhood: z.string().max(120).optional(),
    })
    .optional(),
  origin: z.enum(["manual", "nfe_xml", "auto_restock"]),
  invoiceNumber: z.string().max(80).optional(),
  invoiceKey: z.string().max(120).optional(),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedDeliveryDate: z.string().max(20).optional(),
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receiveImmediately: z.boolean().default(true),
  recordFinancialExpense: z.boolean().default(false),
  notes: z.string().max(600).optional(),
  items: z.array(receiveOrderItemSchema).min(1, "O pedido precisa conter ao menos 1 item."),
});

router.post("/purchase-orders/receive", adminLimiter, async (req: Request, res: Response) => {
  const parsed = receiveOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Dados inválidos para pedido de compra.",
    });
  }

  const input = parsed.data;
  const auth = await authorizeInventoryAccess(req, input.salonId, MANAGEMENT_ROLES);
  if ("error" in auth) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const adminDb = getAdminDb();
    const now = Date.now();
    const batch = adminDb.batch();

    let resolvedSupplierId = input.supplierId || "";
    if (!resolvedSupplierId && input.createSupplierPayload) {
      const supRef = adminDb.collection(`salons/${input.salonId}/suppliers`).doc();
      resolvedSupplierId = supRef.id;
      batch.set(supRef, {
        id: supRef.id,
        salonId: input.salonId,
        ...input.createSupplierPayload,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const orderRef =
      input.orderId && SAFE_ID_REGEX.test(input.orderId)
        ? adminDb.doc(`salons/${input.salonId}/purchaseOrders/${input.orderId}`)
        : adminDb.collection(`salons/${input.salonId}/purchaseOrders`).doc();

    const totalCost = Number(
      input.items.reduce((acc, item) => acc + Number(item.totalCost || item.quantity * item.unitCost), 0).toFixed(2)
    );

    const finalizedItems = [...input.items];

    if (input.receiveImmediately) {
      for (let idx = 0; idx < finalizedItems.length; idx++) {
        const item = finalizedItems[idx];
        let targetProductId = item.productId;
        let prevQty = 0;

        if (targetProductId && SAFE_ID_REGEX.test(targetProductId)) {
          const pRef = adminDb.doc(`salons/${input.salonId}/inventory/${targetProductId}`);
          const pSnap = await pRef.get();
          if (pSnap.exists) {
            const pData = pSnap.data() || {};
            prevQty = Number(pData.quantity || 0);
            const newQty = Number((prevQty + item.quantity).toFixed(3));
            const existingLinks = Array.isArray(pData.supplierLinks) ? pData.supplierLinks : [];
            const nextLinks = resolvedSupplierId
              ? [
                  ...existingLinks.filter(
                    (l: { supplierId?: string }) => l.supplierId !== resolvedSupplierId
                  ),
                  {
                    id: `${resolvedSupplierId}_${targetProductId}`,
                    supplierId: resolvedSupplierId,
                    supplierName: input.supplierName,
                    supplierCode: item.sku || "",
                    supplierDescription: item.productName,
                    costPrice: item.unitCost,
                  },
                ]
              : existingLinks;

            batch.set(
              pRef,
              {
                quantity: newQty,
                costPrice: item.unitCost > 0 ? item.unitCost : Number(pData.costPrice || 0),
                supplier: input.supplierName,
                supplierId: resolvedSupplierId || pData.supplierId || "",
                supplierLinks: nextLinks,
                ...(item.expirationDate ? { nextExpirationDate: item.expirationDate } : {}),
                ...(item.barcode && !pData.barcode ? { barcode: item.barcode } : {}),
                updatedAt: now,
              },
              { merge: true }
            );

            const movRef = adminDb.collection(`salons/${input.salonId}/stockMovements`).doc();
            batch.set(movRef, {
              id: movRef.id,
              salonId: input.salonId,
              productId: targetProductId,
              productName: String(pData.name || item.productName),
              productSku: String(pData.sku || item.sku || ""),
              type: "purchase_order",
              quantityDelta: item.quantity,
              previousQuantity: prevQty,
              newQuantity: newQty,
              unitCost: item.unitCost,
              totalCost: item.totalCost,
              reason:
                input.origin === "nfe_xml"
                  ? `NF-e #${input.invoiceNumber || input.orderNumber} · ${input.supplierName}`
                  : `Pedido #${input.orderNumber} · ${input.supplierName}`,
              notes: input.notes || "Recebimento de pedido de compra",
              expirationDate: item.expirationDate || null,
              supplierId: resolvedSupplierId || null,
              supplierName: input.supplierName,
              purchaseOrderId: orderRef.id,
              movementDate: input.receivedDate,
              performedById: auth.ctx.uid,
              performedByName: auth.ctx.name,
              createdAt: now,
            });
            continue;
          }
        }

        // Create new product when unlinked or createNewProduct=true
        const newProdRef = adminDb.collection(`salons/${input.salonId}/inventory`).doc();
        targetProductId = newProdRef.id;
        finalizedItems[idx] = { ...item, productId: targetProductId, createNewProduct: false };

        const suggestedSell = Number((item.unitCost * 2).toFixed(2));
        batch.set(newProdRef, {
          id: targetProductId,
          salonId: input.salonId,
          name: item.productName,
          brand: item.brand || "Geral",
          sku: item.sku || `SKU-${Math.floor(10000 + Math.random() * 89999)}`,
          barcode: item.barcode || "",
          category: item.category || "Uso Técnico Clínico",
          stockLocation: item.stockLocation || "resale",
          quantity: item.quantity,
          minQuantity: Math.max(1, Math.round(item.quantity * 0.25)),
          costPrice: item.unitCost,
          sellingPrice: suggestedSell,
          supplier: input.supplierName,
          supplierId: resolvedSupplierId,
          supplierLinks: resolvedSupplierId
            ? [
                {
                  id: `${resolvedSupplierId}_${targetProductId}`,
                  supplierId: resolvedSupplierId,
                  supplierName: input.supplierName,
                  supplierCode: item.sku || "",
                  supplierDescription: item.productName,
                  costPrice: item.unitCost,
                },
              ]
            : [],
          ...(item.expirationDate ? { nextExpirationDate: item.expirationDate } : {}),
          createdAt: now,
          updatedAt: now,
        });

        const movRef = adminDb.collection(`salons/${input.salonId}/stockMovements`).doc();
        batch.set(movRef, {
          id: movRef.id,
          salonId: input.salonId,
          productId: targetProductId,
          productName: item.productName,
          productSku: item.sku || "",
          type: "purchase_order",
          quantityDelta: item.quantity,
          previousQuantity: 0,
          newQuantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
          reason:
            input.origin === "nfe_xml"
              ? `NF-e #${input.invoiceNumber || input.orderNumber} (Novo item) · ${input.supplierName}`
              : `Pedido #${input.orderNumber} (Novo item) · ${input.supplierName}`,
          notes: input.notes || "Cadastro automático via recebimento de compra",
          expirationDate: item.expirationDate || null,
          supplierId: resolvedSupplierId || null,
          supplierName: input.supplierName,
          purchaseOrderId: orderRef.id,
          movementDate: input.receivedDate,
          performedById: auth.ctx.uid,
          performedByName: auth.ctx.name,
          createdAt: now,
        });
      }

      if (input.recordFinancialExpense && totalCost > 0) {
        const finRef = adminDb.collection(`salons/${input.salonId}/financialTransactions`).doc();
        batch.set(finRef, {
          id: finRef.id,
          description:
            input.origin === "nfe_xml"
              ? `NF-e #${input.invoiceNumber || input.orderNumber} - ${input.supplierName}`
              : `Pedido de Compra #${input.orderNumber} - ${input.supplierName}`,
          amount: totalCost,
          type: "expense",
          category: "Compra de Estoque",
          date: input.receivedDate,
          status: "paid",
          paymentMethod: "Pix / Boleto",
          cashRegisterName: "Caixa Principal",
          createdByName: auth.ctx.name,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    batch.set(
      orderRef,
      {
        id: orderRef.id,
        salonId: input.salonId,
        orderNumber: input.orderNumber,
        supplierId: resolvedSupplierId,
        supplierName: input.supplierName,
        supplierDocument: input.supplierDocument || "",
        status: input.receiveImmediately ? "received" : "ordered",
        origin: input.origin,
        invoiceNumber: input.invoiceNumber || "",
        invoiceKey: input.invoiceKey || "",
        orderDate: input.orderDate,
        expectedDeliveryDate: input.expectedDeliveryDate || "",
        receivedDate: input.receiveImmediately ? input.receivedDate : "",
        items: finalizedItems,
        totalCost,
        recordFinancialExpense: input.recordFinancialExpense,
        notes: input.notes || "",
        createdByName: auth.ctx.name,
        ...(input.receiveImmediately ? { receivedByName: auth.ctx.name } : {}),
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    await batch.commit();
    return res.status(200).json({ success: true, orderId: orderRef.id });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({
        error: "Admin SDK indisponível neste ambiente.",
        code: "ADMIN_UNAVAILABLE",
      });
    }
    console.error("[Inventory] Erro ao processar pedido de compra:", err);
    return res.status(500).json({ error: "Erro interno ao processar pedido de compra." });
  }
});

const auditFinalizeSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  sessionId: z.string().max(160).optional(),
  sessionNumber: z.string().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stockLocationFilter: z.enum(["all", "resale", "internal_use", "warehouse", "mixed"]).default("all"),
  notes: z.string().max(600).optional(),
  scanLogs: z
    .array(
      z.object({
        id: z.string(),
        query: z.string(),
        productId: z.string(),
        productName: z.string(),
        delta: z.number(),
        scannedAt: z.number(),
      })
    )
    .max(500)
    .default([]),
  items: z
    .array(
      z.object({
        productId: z.string().regex(SAFE_ID_REGEX),
        productName: z.string().min(1).max(200),
        sku: z.string().max(100).optional(),
        barcode: z.string().max(100).optional(),
        stockLocation: z.enum(["resale", "internal_use", "warehouse", "mixed"]).optional(),
        systemQty: z.number(),
        countedQty: z.number().min(0),
        diffQty: z.number(),
        unitCost: z.number().min(0),
        financialImpact: z.number(),
        counted: z.boolean(),
      })
    )
    .min(1),
});

router.post("/audit/finalize", adminLimiter, async (req: Request, res: Response) => {
  const parsed = auditFinalizeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Dados inválidos para finalizar inventário.",
    });
  }

  const input = parsed.data;
  const auth = await authorizeInventoryAccess(req, input.salonId, MANAGEMENT_ROLES);
  if ("error" in auth) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const adminDb = getAdminDb();
    const now = Date.now();
    const batch = adminDb.batch();

    let missingUnitsTotal = 0;
    let surplusUnitsTotal = 0;
    let balanceImpactAmount = 0;

    for (const item of input.items) {
      if (!item.counted) continue;
      const diff = Number((item.countedQty - item.systemQty).toFixed(3));
      if (diff < 0) missingUnitsTotal += Math.abs(diff);
      if (diff > 0) surplusUnitsTotal += diff;
      balanceImpactAmount += Number((diff * item.unitCost).toFixed(2));

      if (diff !== 0) {
        const pRef = adminDb.doc(`salons/${input.salonId}/inventory/${item.productId}`);
        batch.set(pRef, { quantity: item.countedQty, updatedAt: now }, { merge: true });

        const movRef = adminDb.collection(`salons/${input.salonId}/stockMovements`).doc();
        batch.set(movRef, {
          id: movRef.id,
          salonId: input.salonId,
          productId: item.productId,
          productName: item.productName,
          productSku: item.sku || "",
          type: "inventory_adjustment",
          quantityDelta: diff,
          previousQuantity: item.systemQty,
          newQuantity: item.countedQty,
          unitCost: item.unitCost,
          totalCost: Number((diff * item.unitCost).toFixed(2)),
          reason: `Inventário Físico #${input.sessionNumber}`,
          notes: input.notes || "Ajuste automático por auditoria de inventário",
          movementDate: input.date,
          performedById: auth.ctx.uid,
          performedByName: auth.ctx.name,
          createdAt: now,
        });
      }
    }

    const sessionRef =
      input.sessionId && SAFE_ID_REGEX.test(input.sessionId)
        ? adminDb.doc(`salons/${input.salonId}/stockInventories/${input.sessionId}`)
        : adminDb.collection(`salons/${input.salonId}/stockInventories`).doc();

    batch.set(
      sessionRef,
      {
        id: sessionRef.id,
        salonId: input.salonId,
        sessionNumber: input.sessionNumber,
        date: input.date,
        stockLocationFilter: input.stockLocationFilter,
        status: "completed",
        responsibleName: auth.ctx.name,
        items: input.items,
        scanLogs: input.scanLogs,
        missingUnitsTotal: Number(missingUnitsTotal.toFixed(2)),
        surplusUnitsTotal: Number(surplusUnitsTotal.toFixed(2)),
        balanceImpactAmount: Number(balanceImpactAmount.toFixed(2)),
        notes: input.notes || "",
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    await batch.commit();
    return res.status(200).json({ success: true, sessionId: sessionRef.id });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({
        error: "Admin SDK indisponível neste ambiente.",
        code: "ADMIN_UNAVAILABLE",
      });
    }
    console.error("[Inventory] Erro ao finalizar auditoria:", err);
    return res.status(500).json({ error: "Erro interno ao finalizar inventário." });
  }
});

const reviewRequisitionsSchema = z.object({
  salonId: z.string().regex(SAFE_ID_REGEX),
  requisitionIds: z.array(z.string().regex(SAFE_ID_REGEX)).min(1).max(100),
  decision: z.enum(["approved", "rejected"]),
});

router.post("/requisitions/review-batch", adminLimiter, async (req: Request, res: Response) => {
  const parsed = reviewRequisitionsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos para revisar solicitações." });
  }

  const input = parsed.data;
  const auth = await authorizeInventoryAccess(req, input.salonId, MANAGEMENT_ROLES);
  if ("error" in auth) {
    return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const adminDb = getAdminDb();
    const now = Date.now();
    const todayStr = new Date().toISOString().substring(0, 10);
    let processedCount = 0;
    const productRunningQty = new Map<string, { qty: number; name: string; sku: string; costPrice: number }>();

    // Process in chunks of 25 items to respect Firestore batch limits
    const CHUNK_SIZE = 25;
    for (let i = 0; i < input.requisitionIds.length; i += CHUNK_SIZE) {
      const chunkIds = input.requisitionIds.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();

      for (const reqId of chunkIds) {
        const reqRef = adminDb.doc(`salons/${input.salonId}/stockRequisitions/${reqId}`);
        const reqSnap = await reqRef.get();
        if (!reqSnap.exists) continue;

        const rData = reqSnap.data() || {};
        if (rData.status !== "pending") continue;

        if (input.decision === "approved" && typeof rData.productId === "string" && SAFE_ID_REGEX.test(rData.productId)) {
          const pRef = adminDb.doc(`salons/${input.salonId}/inventory/${rData.productId}`);
          let cached = productRunningQty.get(rData.productId);
          if (!cached) {
            const pSnap = await pRef.get();
            if (pSnap.exists) {
              const pData = pSnap.data() || {};
              cached = {
                qty: Number(pData.quantity || 0),
                name: String(pData.name || rData.productName || "Produto"),
                sku: String(pData.sku || rData.productSku || ""),
                costPrice: Number(pData.costPrice || 0),
              };
            }
          }

          if (cached) {
            const prevQty = cached.qty;
            const qtyReq = Number(rData.quantity || 0);
            const nextQty = Math.max(0, Number((prevQty - qtyReq).toFixed(3)));
            cached.qty = nextQty;
            productRunningQty.set(rData.productId, cached);

            batch.set(pRef, { quantity: nextQty, updatedAt: now }, { merge: true });

            const movRef = adminDb.collection(`salons/${input.salonId}/stockMovements`).doc();
            batch.set(movRef, {
              id: movRef.id,
              salonId: input.salonId,
              productId: rData.productId,
              productName: cached.name,
              productSku: cached.sku,
              type: "requisition",
              quantityDelta: -qtyReq,
              previousQuantity: prevQty,
              newQuantity: nextQty,
              unitCost: cached.costPrice,
              totalCost: Number((cached.costPrice * qtyReq).toFixed(2)),
              reason: `Solicitação aprovada · ${String(rData.professionalName || rData.requesterName || "Equipe")}`,
              notes: String(rData.notes || rData.serviceName || "Baixa por solicitação de saída"),
              professionalId: rData.professionalId || null,
              professionalName: rData.professionalName || null,
              requisitionId: reqId,
              movementDate: todayStr,
              performedById: auth.ctx.uid,
              performedByName: auth.ctx.name,
              createdAt: now,
            });
          }
        }

        batch.set(
          reqRef,
          {
            status: input.decision,
            reviewedByName: auth.ctx.name,
            reviewedAt: now,
            updatedAt: now,
          },
          { merge: true }
        );
        processedCount += 1;
      }

      await batch.commit();
    }

    return res.status(200).json({ success: true, processedCount });
  } catch (err: unknown) {
    if (isFirebaseAdminCredentialError(err)) {
      return res.status(503).json({
        error: "Admin SDK indisponível neste ambiente.",
        code: "ADMIN_UNAVAILABLE",
      });
    }
    console.error("[Inventory] Erro ao revisar solicitações:", err);
    return res.status(500).json({ error: "Erro interno ao revisar solicitações de saída." });
  }
});

export { router as inventoryRoutes };
