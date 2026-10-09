import { Request, Response } from 'express';
import { getAdminDb } from '../../firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

export default async function applyCouponHandler(req: Request, res: Response) {
  const { code, salonId } = req.body;

  if (code !== 'ANGULARGF') {
    return res.status(400).json({ error: 'Cupom inválido.' });
  }

  const db = getAdminDb();
  
  try {
    // 1. Check coupon validity
    const couponRef = db.collection('coupons').doc(code);
    const couponSnap = await couponRef.get();
    
    if (!couponSnap.exists || !couponSnap.data()?.isValid) {
      return res.status(400).json({ error: 'Cupom inválido ou expirado.' });
    }

    // 2. Update Salon plan
    const salonRef = db.collection('salons').doc(salonId);
    await salonRef.update({
      plan: 'performance', // Assuming 'performance' corresponds to PRO/597
      subscriptionStatus: 'active',
      updatedAt: FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true, message: 'Cupom aplicado com sucesso!' });
  } catch (error) {
    console.error('Erro ao aplicar cupom:', error);
    return res.status(500).json({ error: 'Erro interno ao aplicar cupom.' });
  }
}
