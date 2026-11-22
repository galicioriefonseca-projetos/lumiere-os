import { auth, db } from '@/lib/firebase';
import {
  ComandaItem,
  ComandaPaymentSplit,
  CommissionPayoutItem,
} from '@/types';
import {
  collection,
  doc,
  getDoc,
  setDoc,
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

export interface FinalizeComandaPayload {
  salonId: string;
  comandaId: string;
  clientId: string;
  clientName: string;
  items: ComandaItem[];
  paymentSplits: ComandaPaymentSplit[];
  cashRegisterName: string;
  discountAmount: number;
  chargesAmount: number;
  saveDifferenceToClientBalance: boolean;
  prontuarioNotes?: string;
  notes?: string;
  date?: string;
}

export async function finalizeComandaApi(
  payload: FinalizeComandaPayload
): Promise<{ success: boolean; comandaNumber?: number; finalTotal: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/operations/comandas/finalize', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 503) {
    // Fallback client-side atomic batch if Admin SDK credentials are unavailable in local preview
    const subtotal = payload.items.reduce((sum, i) => sum + Number(i.price || 0), 0);
    const servicesTotal = payload.items
      .filter((i) => i.type === 'service' || i.type === 'package')
      .reduce((sum, i) => sum + Number(i.price || 0), 0);
    const productsTotal = payload.items
      .filter((i) => i.type === 'product')
      .reduce((sum, i) => sum + Number(i.price || 0), 0);
    const finalTotal = Math.max(0, subtotal - payload.discountAmount + payload.chargesAmount);
    const validSplits = payload.paymentSplits.filter((s) => s.amount > 0);
    const paidAmount = validSplits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const now = Date.now();
    const comandaNum = Math.floor(100 + (now % 9000));
    const primaryMethod = validSplits[0]?.method || 'pix';
    const todayStr = payload.date || new Date().toISOString().substring(0, 10);
    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const batch = writeBatch(db);
    const comandaRef = doc(db, `salons/${payload.salonId}/comandas/${payload.comandaId}`);
    batch.set(
      comandaRef,
      {
        clientId: payload.clientId,
        clientName: payload.clientName,
        status: 'completed',
        comandaNumber: comandaNum,
        items: payload.items,
        totalAmount: subtotal,
        servicesTotal,
        productsTotal,
        discount: payload.discountAmount,
        charges: payload.chargesAmount,
        finalTotal,
        paidAmount,
        paymentSplits: validSplits,
        paymentMethod: primaryMethod,
        cashRegisterName: payload.cashRegisterName || 'Caixa Principal',
        prontuarioNotes: payload.prontuarioNotes || '',
        notes: payload.notes || '',
        closedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    for (const item of payload.items) {
      const proportion = subtotal > 0 ? item.price / subtotal : 0;
      const itemNetPrice = Math.max(0, Number((item.price - payload.discountAmount * proportion).toFixed(2)));
      const appRef = item.appointmentId
        ? doc(db, `salons/${payload.salonId}/appointments/${item.appointmentId}`)
        : doc(collection(db, `salons/${payload.salonId}/appointments`));
      batch.set(
        appRef,
        {
          id: appRef.id,
          clientId: payload.clientId,
          clientName: payload.clientName,
          professionalId: item.professionalId,
          professionalName: item.professionalName,
          serviceId: item.id,
          serviceName: item.name,
          price: itemNetPrice,
          type: item.type === 'product' ? 'product' : 'service',
          date: todayStr,
          time: timeStr,
          status: 'completed',
          paymentMethod: primaryMethod,
          comandaId: payload.comandaId,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      if (item.type === 'product' && item.id) {
        const invRef = doc(db, `salons/${payload.salonId}/inventory/${item.id}`);
        const invSnap = await getDoc(invRef);
        if (invSnap.exists()) {
          const invData = invSnap.data();
          const prevQty = Number(invData.quantity || 0);
          const soldQty = Number(item.quantity || 1);
          const nextQty = Math.max(0, Number((prevQty - soldQty).toFixed(3)));
          batch.set(invRef, { quantity: nextQty, updatedAt: now }, { merge: true });

          const movRef = doc(collection(db, `salons/${payload.salonId}/stockMovements`));
          batch.set(movRef, {
            id: movRef.id,
            salonId: payload.salonId,
            productId: item.id,
            productName: String(invData.name || item.name),
            productSku: String(invData.sku || ''),
            type: 'comanda_sale',
            quantityDelta: -soldQty,
            previousQuantity: prevQty,
            newQuantity: nextQty,
            unitCost: Number(invData.costPrice || 0),
            totalCost: Number((Number(invData.costPrice || 0) * soldQty).toFixed(2)),
            reason: `Venda · Comanda #${comandaNum} (${payload.clientName})`,
            notes: `Venda realizada por ${item.professionalName}`,
            professionalId: item.professionalId,
            professionalName: item.professionalName,
            comandaId: payload.comandaId,
            movementDate: todayStr,
            performedById: auth.currentUser?.uid || 'system',
            performedByName: item.professionalName || 'Caixa',
            createdAt: now,
          });
        }
      }
    }

    const splits = validSplits.length > 0 ? validSplits : [{ id: 'auto', method: 'pix' as const, amount: finalTotal }];
    for (const s of splits) {
      if (s.amount <= 0) continue;
      const finRef = doc(collection(db, `salons/${payload.salonId}/financialTransactions`));
      batch.set(finRef, {
        id: finRef.id,
        description: `Comanda #${comandaNum} - ${payload.clientName}`,
        amount: s.amount,
        type: 'revenue',
        category: productsTotal > servicesTotal ? 'Revenda de Produtos' : 'Serviços',
        date: todayStr,
        status: 'paid',
        paymentMethod: s.method,
        cashRegisterName: payload.cashRegisterName || 'Caixa Principal',
        comandaId: payload.comandaId,
        comandaNumber: comandaNum,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (payload.prontuarioNotes?.trim() && payload.clientId !== 'consumidor-final') {
      const histRef = doc(collection(db, `salons/${payload.salonId}/clients/${payload.clientId}/history`));
      batch.set(histRef, {
        id: histRef.id,
        type: 'note_added',
        title: `Prontuário técnico · Comanda #${comandaNum}`,
        description: payload.prontuarioNotes.trim(),
        createdBy: auth.currentUser?.uid || 'system',
        createdAt: now,
      });
    }

    await batch.commit();
    return { success: true, comandaNumber: comandaNum, finalTotal };
  }

  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    comandaNumber?: number;
    finalTotal?: number;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao finalizar comanda.');
  }
  return {
    success: Boolean(data.success),
    comandaNumber: data.comandaNumber,
    finalTotal: Number(data.finalTotal || 0),
  };
}

export async function reopenComandaApi(salonId: string, comandaId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/operations/comandas/reopen', {
    method: 'POST',
    headers,
    body: JSON.stringify({ salonId, comandaId }),
  });
  if (res.status === 503) {
    const ref = doc(db, `salons/${salonId}/comandas/${comandaId}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Comanda não encontrada.');
    await setDoc(ref, { status: 'checkout_pending', updatedAt: Date.now() }, { merge: true });
    return;
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao reabrir comanda.');
  }
}

export interface PayCommissionsBatchPayload {
  salonId: string;
  periodStart: string;
  periodEnd: string;
  paymentMethod: string;
  cashRegisterName?: string;
  notes?: string;
  items: CommissionPayoutItem[];
}

export async function payCommissionsBatchApi(
  payload: PayCommissionsBatchPayload
): Promise<{ success: boolean; payoutId: string; totalAmount: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/operations/commissions/pay-batch', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status === 503) {
    const now = Date.now();
    const todayStr = new Date().toISOString().substring(0, 10);
    const totalAmount = Number(
      payload.items.reduce((sum, i) => sum + Number(i.netAmount || 0), 0).toFixed(2)
    );
    const batch = writeBatch(db);
    const payoutRef = doc(collection(db, `salons/${payload.salonId}/commissionPayouts`));
    batch.set(payoutRef, {
      id: payoutRef.id,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      paymentMethod: payload.paymentMethod,
      cashRegisterName: payload.cashRegisterName || 'Caixa Principal',
      notes: payload.notes || '',
      totalAmount,
      professionalsCount: payload.items.length,
      items: payload.items,
      paidAt: now,
      createdAt: now,
    });

    for (const item of payload.items) {
      for (const adjId of item.adjustmentsAppliedIds || []) {
        batch.set(
          doc(db, `salons/${payload.salonId}/commissionAdjustments/${adjId}`),
          { status: 'settled', payoutId: payoutRef.id, updatedAt: now },
          { merge: true }
        );
      }
    }

    const finRef = doc(collection(db, `salons/${payload.salonId}/financialTransactions`));
    batch.set(finRef, {
      id: finRef.id,
      description: `Repasse de Comissões (${payload.items.length} prof.) · ${payload.periodStart} a ${payload.periodEnd}`,
      amount: totalAmount,
      type: 'expense',
      category: 'Comissões',
      date: todayStr,
      status: 'paid',
      paymentMethod: payload.paymentMethod,
      cashRegisterName: payload.cashRegisterName || 'Caixa Principal',
      payoutId: payoutRef.id,
      createdAt: now,
      updatedAt: now,
    });

    await batch.commit();
    return { success: true, payoutId: payoutRef.id, totalAmount };
  }

  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    payoutId?: string;
    totalAmount?: number;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'Falha ao pagar comissões selecionadas.');
  }
  return {
    success: Boolean(data.success),
    payoutId: data.payoutId || '',
    totalAmount: Number(data.totalAmount || 0),
  };
}
