import { auth, db } from '@/lib/firebase';
import { OperationType, reportFirestoreListenerError } from '@/lib/firestoreError';
import {
  InventoryItem,
  NfeParsedInvoice,
  Professional,
  PurchaseOrder,
  PurchaseOrderItem,
  StockInventoryItemCount,
  StockInventoryScanLog,
  StockInventorySession,
  StockLocation,
  StockMovement,
  StockRequisition,
  Supplier,
} from '@/types';
import { parseBrazilianNfeXml } from '@/utils/nfeParser';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export function subscribeInventoryItems(
  salonId: string,
  onData: (items: InventoryItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!salonId || !auth?.currentUser) return () => {};
  const path = `salons/${salonId}/inventory`;
  const q = query(collection(db, 'salons', salonId, 'inventory'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as InventoryItem)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      onData(list);
    },
    (err) => {
      reportFirestoreListenerError(err, OperationType.LIST, path);
      onError?.(err);
    }
  );
}

export function subscribeSuppliers(
  salonId: string,
  onData: (items: Supplier[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!salonId || !auth?.currentUser) return () => {};
  const path = `salons/${salonId}/suppliers`;
  const q = query(collection(db, 'salons', salonId, 'suppliers'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Supplier)
        .sort((a, b) => (a.tradeName || '').localeCompare(b.tradeName || ''));
      onData(list);
    },
    (err) => {
      reportFirestoreListenerError(err, OperationType.LIST, path);
      onError?.(err);
    }
  );
}

export function subscribePurchaseOrders(
  salonId: string,
  onData: (items: PurchaseOrder[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!salonId || !auth?.currentUser) return () => {};
  const path = `salons/${salonId}/purchaseOrders`;
  const q = query(
    collection(db, 'salons', salonId, 'purchaseOrders'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PurchaseOrder));
    },
    (err) => {
      reportFirestoreListenerError(err, OperationType.LIST, path);
      onError?.(err);
    }
  );
}

export function subscribeStockMovements(
  salonId: string,
  onData: (items: StockMovement[]) => void,
  productId?: string,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!salonId || !auth?.currentUser) return () => {};
  const path = `salons/${salonId}/stockMovements`;
  const colRef = collection(db, 'salons', salonId, 'stockMovements');
  const q = productId
    ? query(colRef, where('productId', '==', productId))
    : query(colRef, orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as StockMovement)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onData(list);
    },
    (err) => {
      reportFirestoreListenerError(err, OperationType.LIST, path);
      onError?.(err);
    }
  );
}

export function subscribeStockInventories(
  salonId: string,
  onData: (items: StockInventorySession[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!salonId || !auth?.currentUser) return () => {};
  const path = `salons/${salonId}/stockInventories`;
  const q = query(
    collection(db, 'salons', salonId, 'stockInventories'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StockInventorySession));
    },
    (err) => {
      reportFirestoreListenerError(err, OperationType.LIST, path);
      onError?.(err);
    }
  );
}

export function subscribeStockRequisitions(
  salonId: string,
  onData: (items: StockRequisition[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!salonId || !auth?.currentUser) return () => {};
  const path = `salons/${salonId}/stockRequisitions`;
  const q = query(
    collection(db, 'salons', salonId, 'stockRequisitions'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StockRequisition));
    },
    (err) => {
      reportFirestoreListenerError(err, OperationType.LIST, path);
      onError?.(err);
    }
  );
}

export function subscribeSalonProfessionals(
  salonId: string,
  onData: (items: Professional[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!salonId || !auth?.currentUser) return () => {};
  const path = `salons/${salonId}/professionals`;
  return onSnapshot(
    query(collection(db, 'salons', salonId, 'professionals')),
    (snap) => {
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Professional)
          .filter((p) => p.isActive !== false && p.status !== 'deleted')
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      );
    },
    (err) => {
      reportFirestoreListenerError(err, OperationType.LIST, path);
      onError?.(err);
    }
  );
}

export async function saveInventoryProduct(
  salonId: string,
  product: Omit<InventoryItem, 'id' | 'updatedAt' | 'createdAt'>,
  existingId?: string
): Promise<string> {
  const now = Date.now();
  if (existingId) {
    await setDoc(
      doc(db, 'salons', salonId, 'inventory', existingId),
      { ...product, salonId, updatedAt: now },
      { merge: true }
    );
    return existingId;
  }
  const ref = await addDoc(collection(db, 'salons', salonId, 'inventory'), {
    ...product,
    salonId,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function deleteInventoryProduct(salonId: string, productId: string): Promise<void> {
  await deleteDoc(doc(db, 'salons', salonId, 'inventory', productId));
}

export async function saveSupplier(
  salonId: string,
  supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<string> {
  const now = Date.now();
  if (existingId) {
    await setDoc(
      doc(db, 'salons', salonId, 'suppliers', existingId),
      { ...supplier, id: existingId, salonId, updatedAt: now },
      { merge: true }
    );
    return existingId;
  }
  const ref = doc(collection(db, 'salons', salonId, 'suppliers'));
  await setDoc(ref, {
    ...supplier,
    id: ref.id,
    salonId,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function deleteSupplier(salonId: string, supplierId: string): Promise<void> {
  await deleteDoc(doc(db, 'salons', salonId, 'suppliers', supplierId));
}

export interface RecordStockMovementPayload {
  salonId: string;
  productId: string;
  direction: 'in' | 'out';
  quantity: number;
  movementDate: string;
  notes: string;
  unitCost?: number;
  expirationDate?: string;
  supplierId?: string;
  supplierName?: string;
  professionalId?: string;
  professionalName?: string;
  recordFinancialExpense?: boolean;
  performedByName?: string;
}

export async function recordStockMovementApi(
  payload: RecordStockMovementPayload
): Promise<{ newQuantity: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/inventory/movement', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 503) {
    const now = Date.now();
    const productRef = doc(db, 'salons', payload.salonId, 'inventory', payload.productId);
    const snap = await getDoc(productRef);
    if (!snap.exists()) throw new Error('Produto não encontrado no estoque.');
    const pData = snap.data();
    const prevQty = Number(pData.quantity || 0);
    const delta = payload.direction === 'in' ? payload.quantity : -payload.quantity;
    const nextQty = Number((prevQty + delta).toFixed(3));
    if (nextQty < 0) {
      throw new Error(`Estoque insuficiente (${prevQty} disponíveis).`);
    }

    const effectiveUnitCost =
      payload.unitCost && payload.unitCost > 0 ? payload.unitCost : Number(pData.costPrice || 0);
    const totalCost = Number((effectiveUnitCost * payload.quantity).toFixed(2));

    const batch = writeBatch(db);
    batch.set(
      productRef,
      {
        quantity: nextQty,
        ...(payload.direction === 'in' && payload.unitCost && payload.unitCost > 0
          ? { costPrice: payload.unitCost }
          : {}),
        ...(payload.direction === 'in' && payload.expirationDate
          ? { nextExpirationDate: payload.expirationDate }
          : {}),
        ...(payload.direction === 'in' && payload.supplierName
          ? { supplier: payload.supplierName, supplierId: payload.supplierId || '' }
          : {}),
        updatedAt: now,
      },
      { merge: true }
    );

    const movRef = doc(collection(db, 'salons', payload.salonId, 'stockMovements'));
    batch.set(movRef, {
      id: movRef.id,
      salonId: payload.salonId,
      productId: payload.productId,
      productName: String(pData.name || 'Produto'),
      productSku: String(pData.sku || ''),
      type: payload.direction,
      quantityDelta: delta,
      previousQuantity: prevQty,
      newQuantity: nextQty,
      unitCost: effectiveUnitCost,
      totalCost,
      reason:
        payload.direction === 'in'
          ? payload.supplierName
            ? `Entrada · ${payload.supplierName}`
            : 'Entrada manual de estoque'
          : payload.professionalName
            ? `Saída para profissional · ${payload.professionalName}`
            : 'Saída manual de estoque',
      notes: payload.notes,
      expirationDate: payload.expirationDate || null,
      supplierId: payload.supplierId || null,
      supplierName: payload.supplierName || null,
      professionalId: payload.professionalId || null,
      professionalName: payload.professionalName || null,
      movementDate: payload.movementDate,
      performedById: auth.currentUser?.uid || 'system',
      performedByName: payload.performedByName || 'Operador',
      createdAt: now,
    });

    if (payload.direction === 'in' && payload.recordFinancialExpense && totalCost > 0) {
      const finRef = doc(collection(db, 'salons', payload.salonId, 'financialTransactions'));
      batch.set(finRef, {
        id: finRef.id,
        description: `Compra Estoque: ${String(pData.name || 'Produto')} (${payload.quantity}x)`,
        amount: totalCost,
        type: 'expense',
        category: 'Compra de Estoque',
        date: payload.movementDate,
        status: 'paid',
        paymentMethod: 'Pix / Transferência',
        cashRegisterName: 'Caixa Principal',
        createdAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();
    return { newQuantity: nextQty };
  }

  const data = (await res.json().catch(() => ({}))) as { newQuantity?: number; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao registrar movimentação de estoque.');
  }
  return { newQuantity: Number(data.newQuantity || 0) };
}

export async function parseNfeXmlApi(salonId: string, xmlContent: string): Promise<NfeParsedInvoice> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/inventory/nfe-parse', {
    method: 'POST',
    headers,
    body: JSON.stringify({ salonId, xmlContent }),
  });

  if (res.status === 503 || res.status === 404) {
    return parseBrazilianNfeXml(xmlContent);
  }

  const data = (await res.json().catch(() => ({}))) as {
    invoice?: NfeParsedInvoice;
    error?: string;
  };
  if (!res.ok || !data.invoice) {
    throw new Error(data.error || 'Não foi possível ler o arquivo XML de NF-e.');
  }
  return data.invoice;
}

export interface ReceivePurchaseOrderPayload {
  salonId: string;
  orderId?: string;
  orderNumber: string;
  supplierId?: string;
  supplierName: string;
  supplierDocument?: string;
  createSupplierPayload?: {
    tradeName: string;
    companyName?: string;
    document?: string;
    phone?: string;
    zipCode?: string;
    state?: string;
    city?: string;
    address?: string;
    number?: string;
    neighborhood?: string;
  };
  origin: 'manual' | 'nfe_xml' | 'auto_restock';
  invoiceNumber?: string;
  invoiceKey?: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  receivedDate: string;
  receiveImmediately: boolean;
  recordFinancialExpense: boolean;
  notes?: string;
  items: PurchaseOrderItem[];
  operatorName?: string;
}

export async function receivePurchaseOrderApi(
  payload: ReceivePurchaseOrderPayload
): Promise<{ orderId: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/inventory/purchase-orders/receive', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 503) {
    const now = Date.now();
    const batch = writeBatch(db);
    let resolvedSupplierId = payload.supplierId || '';

    if (!resolvedSupplierId && payload.createSupplierPayload) {
      const supRef = doc(collection(db, 'salons', payload.salonId, 'suppliers'));
      resolvedSupplierId = supRef.id;
      batch.set(supRef, {
        id: supRef.id,
        salonId: payload.salonId,
        ...payload.createSupplierPayload,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const orderRef = payload.orderId
      ? doc(db, 'salons', payload.salonId, 'purchaseOrders', payload.orderId)
      : doc(collection(db, 'salons', payload.salonId, 'purchaseOrders'));

    const totalCost = Number(
      payload.items
        .reduce((acc, item) => acc + Number(item.totalCost || item.quantity * item.unitCost), 0)
        .toFixed(2)
    );
    const finalizedItems = [...payload.items];

    if (payload.receiveImmediately) {
      for (let i = 0; i < finalizedItems.length; i++) {
        const item = finalizedItems[i];
        if (item.productId) {
          const pRef = doc(db, 'salons', payload.salonId, 'inventory', item.productId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const pData = pSnap.data();
            const prevQty = Number(pData.quantity || 0);
            const newQty = Number((prevQty + item.quantity).toFixed(3));
            batch.set(
              pRef,
              {
                quantity: newQty,
                costPrice: item.unitCost > 0 ? item.unitCost : Number(pData.costPrice || 0),
                supplier: payload.supplierName,
                ...(item.expirationDate ? { nextExpirationDate: item.expirationDate } : {}),
                updatedAt: now,
              },
              { merge: true }
            );
            const movRef = doc(collection(db, 'salons', payload.salonId, 'stockMovements'));
            batch.set(movRef, {
              id: movRef.id,
              salonId: payload.salonId,
              productId: item.productId,
              productName: String(pData.name || item.productName),
              productSku: String(pData.sku || item.sku || ''),
              type: 'purchase_order',
              quantityDelta: item.quantity,
              previousQuantity: prevQty,
              newQuantity: newQty,
              unitCost: item.unitCost,
              totalCost: item.totalCost,
              reason: `Pedido #${payload.orderNumber} · ${payload.supplierName}`,
              notes: payload.notes || 'Recebimento de compra',
              supplierName: payload.supplierName,
              purchaseOrderId: orderRef.id,
              movementDate: payload.receivedDate,
              performedById: auth.currentUser?.uid || 'system',
              performedByName: payload.operatorName || 'Operador',
              createdAt: now,
            });
            continue;
          }
        }

        const newProdRef = doc(collection(db, 'salons', payload.salonId, 'inventory'));
        finalizedItems[i] = { ...item, productId: newProdRef.id, createNewProduct: false };
        batch.set(newProdRef, {
          id: newProdRef.id,
          salonId: payload.salonId,
          name: item.productName,
          brand: item.brand || 'Geral',
          sku: item.sku || `SKU-${Math.floor(10000 + Math.random() * 89999)}`,
          barcode: item.barcode || '',
          category: item.category || 'Uso Técnico Clínico',
          stockLocation: item.stockLocation || 'resale',
          quantity: item.quantity,
          minQuantity: Math.max(1, Math.round(item.quantity * 0.25)),
          costPrice: item.unitCost,
          sellingPrice: Number((item.unitCost * 2).toFixed(2)),
          supplier: payload.supplierName,
          supplierId: resolvedSupplierId,
          ...(item.expirationDate ? { nextExpirationDate: item.expirationDate } : {}),
          createdAt: now,
          updatedAt: now,
        });
      }

      if (payload.recordFinancialExpense && totalCost > 0) {
        const finRef = doc(collection(db, 'salons', payload.salonId, 'financialTransactions'));
        batch.set(finRef, {
          id: finRef.id,
          description: `Pedido de Compra #${payload.orderNumber} - ${payload.supplierName}`,
          amount: totalCost,
          type: 'expense',
          category: 'Compra de Estoque',
          date: payload.receivedDate,
          status: 'paid',
          paymentMethod: 'Pix / Boleto',
          cashRegisterName: 'Caixa Principal',
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    batch.set(
      orderRef,
      {
        id: orderRef.id,
        salonId: payload.salonId,
        orderNumber: payload.orderNumber,
        supplierId: resolvedSupplierId,
        supplierName: payload.supplierName,
        supplierDocument: payload.supplierDocument || '',
        status: payload.receiveImmediately ? 'received' : 'ordered',
        origin: payload.origin,
        invoiceNumber: payload.invoiceNumber || '',
        invoiceKey: payload.invoiceKey || '',
        orderDate: payload.orderDate,
        expectedDeliveryDate: payload.expectedDeliveryDate || '',
        receivedDate: payload.receiveImmediately ? payload.receivedDate : '',
        items: finalizedItems,
        totalCost,
        recordFinancialExpense: payload.recordFinancialExpense,
        notes: payload.notes || '',
        createdByName: payload.operatorName || 'Operador',
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    await batch.commit();
    return { orderId: orderRef.id };
  }

  const data = (await res.json().catch(() => ({}))) as { orderId?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao salvar pedido de compra.');
  }
  return { orderId: data.orderId || '' };
}

export async function saveInventoryAuditDraft(
  salonId: string,
  session: Omit<StockInventorySession, 'id' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<string> {
  const now = Date.now();
  const ref = existingId
    ? doc(db, 'salons', salonId, 'stockInventories', existingId)
    : doc(collection(db, 'salons', salonId, 'stockInventories'));
  await setDoc(
    ref,
    {
      ...session,
      id: ref.id,
      salonId,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  return ref.id;
}

export async function finalizeInventoryAuditApi(payload: {
  salonId: string;
  sessionId?: string;
  sessionNumber: string;
  date: string;
  stockLocationFilter: 'all' | StockLocation;
  notes?: string;
  scanLogs: StockInventoryScanLog[];
  items: StockInventoryItemCount[];
  responsibleName: string;
}): Promise<string> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/inventory/audit/finalize', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 503) {
    const now = Date.now();
    const batch = writeBatch(db);
    let missingUnitsTotal = 0;
    let surplusUnitsTotal = 0;
    let balanceImpactAmount = 0;

    for (const item of payload.items) {
      if (!item.counted) continue;
      const diff = Number((item.countedQty - item.systemQty).toFixed(3));
      if (diff < 0) missingUnitsTotal += Math.abs(diff);
      if (diff > 0) surplusUnitsTotal += diff;
      balanceImpactAmount += Number((diff * item.unitCost).toFixed(2));
      if (diff !== 0) {
        batch.set(
          doc(db, 'salons', payload.salonId, 'inventory', item.productId),
          { quantity: item.countedQty, updatedAt: now },
          { merge: true }
        );
        const movRef = doc(collection(db, 'salons', payload.salonId, 'stockMovements'));
        batch.set(movRef, {
          id: movRef.id,
          salonId: payload.salonId,
          productId: item.productId,
          productName: item.productName,
          productSku: item.sku || '',
          type: 'inventory_adjustment',
          quantityDelta: diff,
          previousQuantity: item.systemQty,
          newQuantity: item.countedQty,
          unitCost: item.unitCost,
          totalCost: Number((diff * item.unitCost).toFixed(2)),
          reason: `Inventário Físico #${payload.sessionNumber}`,
          notes: payload.notes || 'Ajuste por contagem física',
          movementDate: payload.date,
          performedById: auth.currentUser?.uid || 'system',
          performedByName: payload.responsibleName,
          createdAt: now,
        });
      }
    }

    const sessionRef = payload.sessionId
      ? doc(db, 'salons', payload.salonId, 'stockInventories', payload.sessionId)
      : doc(collection(db, 'salons', payload.salonId, 'stockInventories'));
    batch.set(
      sessionRef,
      {
        id: sessionRef.id,
        salonId: payload.salonId,
        sessionNumber: payload.sessionNumber,
        date: payload.date,
        stockLocationFilter: payload.stockLocationFilter,
        status: 'completed',
        responsibleName: payload.responsibleName,
        items: payload.items,
        scanLogs: payload.scanLogs,
        missingUnitsTotal: Number(missingUnitsTotal.toFixed(2)),
        surplusUnitsTotal: Number(surplusUnitsTotal.toFixed(2)),
        balanceImpactAmount: Number(balanceImpactAmount.toFixed(2)),
        notes: payload.notes || '',
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    await batch.commit();
    return sessionRef.id;
  }

  const data = (await res.json().catch(() => ({}))) as { sessionId?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao finalizar auditoria de inventário.');
  }
  return data.sessionId || '';
}

export async function createStockRequisition(
  salonId: string,
  payload: Omit<StockRequisition, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Date.now();
  const ref = doc(collection(db, 'salons', salonId, 'stockRequisitions'));
  await setDoc(ref, {
    ...payload,
    id: ref.id,
    salonId,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function reviewStockRequisitionsBatchApi(
  salonId: string,
  requisitionIds: string[],
  decision: 'approved' | 'rejected',
  reviewerName: string
): Promise<number> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/inventory/requisitions/review-batch', {
    method: 'POST',
    headers,
    body: JSON.stringify({ salonId, requisitionIds, decision }),
  });

  if (res.status === 503) {
    const now = Date.now();
    const todayStr = new Date().toISOString().substring(0, 10);
    let processedCount = 0;
    const productRunningQty = new Map<string, { qty: number; name: string; sku: string; costPrice: number }>();

    const CHUNK = 20;
    for (let i = 0; i < requisitionIds.length; i += CHUNK) {
      const slice = requisitionIds.slice(i, i + CHUNK);
      const batch = writeBatch(db);
      for (const reqId of slice) {
        const reqRef = doc(db, 'salons', salonId, 'stockRequisitions', reqId);
        const rSnap = await getDoc(reqRef);
        if (!rSnap.exists()) continue;
        const rData = rSnap.data();
        if (rData.status !== 'pending') continue;

        if (decision === 'approved' && rData.productId) {
          let cached = productRunningQty.get(rData.productId);
          if (!cached) {
            const pSnap = await getDoc(doc(db, 'salons', salonId, 'inventory', rData.productId));
            if (pSnap.exists()) {
              const pData = pSnap.data();
              cached = {
                qty: Number(pData.quantity || 0),
                name: String(pData.name || rData.productName || 'Produto'),
                sku: String(pData.sku || ''),
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
            batch.set(
              doc(db, 'salons', salonId, 'inventory', rData.productId),
              { quantity: nextQty, updatedAt: now },
              { merge: true }
            );
            const movRef = doc(collection(db, 'salons', salonId, 'stockMovements'));
            batch.set(movRef, {
              id: movRef.id,
              salonId,
              productId: rData.productId,
              productName: cached.name,
              productSku: cached.sku,
              type: 'requisition',
              quantityDelta: -qtyReq,
              previousQuantity: prevQty,
              newQuantity: nextQty,
              unitCost: cached.costPrice,
              totalCost: Number((cached.costPrice * qtyReq).toFixed(2)),
              reason: `Solicitação aprovada · ${String(rData.professionalName || rData.requesterName || 'Equipe')}`,
              notes: String(rData.notes || rData.serviceName || 'Saída solicitada pela equipe'),
              professionalId: rData.professionalId || null,
              professionalName: rData.professionalName || null,
              requisitionId: reqId,
              movementDate: todayStr,
              performedById: auth.currentUser?.uid || 'system',
              performedByName: reviewerName,
              createdAt: now,
            });
          }
        }
        batch.set(
          reqRef,
          { status: decision, reviewedByName: reviewerName, reviewedAt: now, updatedAt: now },
          { merge: true }
        );
        processedCount += 1;
      }
      await batch.commit();
    }
    return processedCount;
  }

  const data = (await res.json().catch(() => ({}))) as { processedCount?: number; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao processar solicitações de saída.');
  }
  return Number(data.processedCount || 0);
}

export function exportRowsToCsv(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(';'), ...rows.map((r) => r.map(escapeCell).join(';'))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
