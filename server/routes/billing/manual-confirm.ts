import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken } from '../../shared/auth.js';

function isEssenzaSalon(salonData: any): boolean {
  return /essenza/i.test(String(salonData?.name || ''));
}

function computeNextDueDate(currentDueDateStr?: string, isEssenza?: boolean): string {
  const base = currentDueDateStr ? new Date(currentDueDateStr) : new Date();
  if (Number.isNaN(base.getTime())) {
    const today = new Date();
    const candidate = new Date(today);
    candidate.setHours(0, 0, 0, 0);
    candidate.setDate(2);
    if (today.getDate() >= 2) candidate.setMonth(candidate.getMonth() + 1);
    const y = candidate.getFullYear();
    const m = String(candidate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-02`;
  }

  if (isEssenza) {
    const next = new Date(base);
    next.setHours(0, 0, 0, 0);
    next.setDate(2);
    next.setMonth(next.getMonth() + 1);
    const y = next.getFullYear();
    const m = String(next.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-02`;
  }

  const next = new Date(base);
  next.setMonth(next.getMonth() + 1);
  return next.toISOString().split('T')[0];
}

export default async function manualConfirmHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const user = await verifyIdToken(authHeader);
    if (!user) {
      return res.status(401).json({ error: 'Autenticação necessária. Sessão expirada.' });
    }

    const adminDb = getAdminDb();
    
    // Verifica se o usuário é platform_admin
    const userDoc = await adminDb.collection('users').doc(user.uid).get();
    const isMasterAdmin = userDoc.data()?.role === 'platform_admin' || user.email === 'galicioriefonseca@gmail.com';
    
    if (!isMasterAdmin) {
      const pAdminDoc = await adminDb.collection('platformAdmins').doc(user.uid).get();
      if (!pAdminDoc.exists) {
        return res.status(403).json({ error: 'Acesso restrito ao Administrador Master da plataforma.' });
      }
    }

    const { salonId, amount, dueDate, paymentMethod = 'PIX', description, paymentId } = req.body || {};

    if (!salonId) {
      return res.status(400).json({ error: 'ID do salão é obrigatório.' });
    }

    const salonRef = adminDb.collection('salons').doc(salonId);
    const salonSnap = await salonRef.get();
    if (!salonSnap.exists) {
      return res.status(404).json({ error: 'Salão não encontrado.' });
    }

    const salonData = salonSnap.data() || {};
    const isEssenza = isEssenzaSalon(salonData);
    
    // Determinar valor da mensalidade
    const planId = salonData.billing?.planId || salonData.plan || 'professional';
    let defaultAmount = 397;
    if (planId === 'founder') defaultAmount = 297;
    else if (planId === 'essential') defaultAmount = 197;
    else if (planId === 'performance_plus') defaultAmount = 597;
    
    const finalAmount = Number(amount || salonData.billing?.value || defaultAmount);
    
    // Data de vencimento desta fatura que está sendo quitada
    const currentInvoiceDueDate = dueDate || salonData.billing?.nextDueDate || (isEssenza ? '2026-10-02' : new Date().toISOString().split('T')[0]);
    
    // Próxima data de vencimento (subsequente)
    const nextDueDateStr = computeNextDueDate(currentInvoiceDueDate, isEssenza);

    const nowTimestamp = Date.now();
    const finalPaymentMethod = String(paymentMethod).toUpperCase();
    const nowIso = new Date().toISOString();

    // 1. Identificar ou criar ID do pagamento
    let targetPaymentId = paymentId;
    if (!targetPaymentId) {
      const cleanDateTag = currentInvoiceDueDate.replace(/\D/g, '_');
      targetPaymentId = `manual_payment_${salonId.slice(0, 8)}_${cleanDateTag}`;
    }

    const paymentDocRef = adminDb.collection(`salons/${salonId}/payments`).doc(targetPaymentId);
    
    const paymentData = {
      id: targetPaymentId,
      salonId,
      plan: planId,
      amount: finalAmount,
      value: finalAmount,
      description: description || `Mensalidade LumièreOS — ${salonData.name || 'Salão'} (${finalPaymentMethod} Manual)`,
      status: 'PAID',
      dueDate: currentInvoiceDueDate,
      paymentMethod: finalPaymentMethod,
      billingType: finalPaymentMethod,
      createdAt: nowTimestamp,
      paidAt: nowTimestamp,
      confirmedBy: user.email || 'master_admin',
      isManual: true,
      updatedAt: nowTimestamp
    };

    await paymentDocRef.set(paymentData, { merge: true });

    // 2. Atualizar documento do Salão
    const salonUpdates: any = {
      status: 'active',
      subscriptionStatus: 'active',
      activationStatus: 'active',
      isActive: true,
      paymentStatus: 'paid',
      billingProvider: 'manual_pix',
      billingMode: 'manual_pix',
      lastPaymentAt: nowTimestamp,
      lastPaymentAmount: finalAmount,
      lastPaymentMethod: finalPaymentMethod.toLowerCase(),
      'billing.status': 'ACTIVE',
      'billing.paymentMethod': finalPaymentMethod,
      'billing.lastPaymentDate': nowIso,
      'billing.lastPaymentAt': nowTimestamp,
      'billing.nextDueDate': nextDueDateStr,
      'billing.value': finalAmount,
      'billing.billingMode': 'manual_pix',
      'billing.fixedDueDay': isEssenza ? 2 : (salonData.billing?.fixedDueDay || 2),
      'billing.updatedAt': nowIso,
      updatedAt: nowTimestamp
    };

    await salonRef.update(salonUpdates);

    // 3. Registrar no histórico de auditoria do salão
    const historyRef = adminDb.collection(`salons/${salonId}/billingHistory`).doc();
    await historyRef.set({
      id: historyRef.id,
      salonId,
      action: 'manual_payment_confirmed',
      description: `Pagamento manual de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalAmount)} (${finalPaymentMethod}) confirmado pelo Admin Master. Próximo vencimento: ${nextDueDateStr}`,
      timestamp: nowTimestamp,
      amount: finalAmount,
      paymentMethod: finalPaymentMethod,
      dueDate: currentInvoiceDueDate,
      nextDueDate: nextDueDateStr,
      adminEmail: user.email,
      createdAt: nowTimestamp
    });

    console.log(`[Manual Billing] Pagamento manual confirmado com sucesso para o salão ${salonData.name} (${salonId}). Próximo vencimento: ${nextDueDateStr}`);

    return res.status(200).json({
      success: true,
      message: `Pagamento manual via ${finalPaymentMethod} registrado com sucesso! O próximo vencimento foi atualizado para ${nextDueDateStr}.`,
      payment: paymentData,
      nextDueDate: nextDueDateStr
    });
  } catch (error: any) {
    console.error('[Manual Billing Error] Falha ao confirmar pagamento manual:', error);
    return res.status(500).json({ error: error.message || 'Erro interno ao registrar pagamento manual.' });
  }
}
