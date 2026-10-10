import { Request, Response } from 'express';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';
import { billingService } from '../../billing/BillingService.js';

export default async function applyCouponHandler(req: Request, res: Response) {
  if (req.method && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const { code, coupon, salonId } = req.body || {};
    const rawCode = String(code || coupon || '').trim().toUpperCase();

    if (!rawCode) {
      return res.status(400).json({ success: false, error: 'Informe o código do cupom.' });
    }

    if (!salonId) {
      return res.status(400).json({ success: false, error: 'Identificador do salão não informado.' });
    }

    let user: any = null;
    try {
      user = await verifyIdToken(req);
    } catch {
      return res.status(401).json({ success: false, error: 'Sessão expirada. Faça login novamente.' });
    }

    const adminDb = getAdminDb();
    const salonSnap = await adminDb.collection('salons').doc(salonId).get();
    if (salonSnap.exists) {
      const authResult = await canManageBilling(user, salonId, salonSnap.data() || {});
      if (!authResult.authorized && salonId !== `salon_${user.uid}`) {
        return res.status(403).json({ success: false, error: authResult.reason || 'Sem permissão para aplicar cupom neste salão.' });
      }
    }

    const validation = await billingService.validateCoupon(rawCode);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error || 'Cupom inválido ou expirado.' });
    }

    const result = await billingService.activateWithCoupon({
      salonId,
      userId: user.uid,
      couponCode: validation.code,
      email: user.email,
      ownerName: user.name,
    });

    return res.status(200).json({
      success: true,
      planId: result.planId,
      couponCode: result.couponCode,
      message: 'Cupom ANGULARGF aplicado com sucesso! Seu plano Performance (R$ 597,00/mês) foi ativado gratuitamente.',
    });
  } catch (error: any) {
    console.error('[Billing] Erro ao aplicar cupom:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Erro interno ao aplicar cupom de desconto.',
    });
  }
}
