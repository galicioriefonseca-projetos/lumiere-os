import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { changeBillingCycle } from '../../billing/BillingCycleService.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';
import type { BillingCycle } from '../../billing/types.js';

const ALLOWED_CYCLES = new Set<BillingCycle>(['MONTHLY', 'SEMIANNUALLY', 'YEARLY']);

export default async function changeBillingCycleHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { salonId, billingCycle } = req.body || {};
    if (!salonId || typeof salonId !== 'string') return res.status(400).json({ error: 'salonId é obrigatório.' });
    if (!ALLOWED_CYCLES.has(billingCycle)) return res.status(400).json({ error: 'Periodicidade inválida. Use MONTHLY, SEMIANNUALLY ou YEARLY.' });

    let user;
    try { user = await verifyIdToken(req); } catch (err: any) {
      return res.status(401).json({ error: err.message || 'Não autorizado.' });
    }

    const adminDb = getAdminDb();
    const salonRef = adminDb.collection('salons').doc(salonId);
    const salonDoc = await salonRef.get();
    if (!salonDoc.exists) return res.status(404).json({ error: 'Salão não encontrado.' });

    const salon = salonDoc.data() || {};
    const authResult = await canManageBilling(user, salonId, salon);
    if (!authResult.authorized) return res.status(403).json({ error: authResult.reason || 'Sem permissão para alterar a assinatura.' });

    const billing = salon.billing || {};
    if (!billing.subscriptionId) return res.status(409).json({ error: 'Esta conta ainda não possui uma assinatura Asaas ativa. Configure o pagamento antes de alterar a periodicidade.' });
    if (String(billing.status || '').toUpperCase() !== 'ACTIVE') return res.status(409).json({ error: 'A periodicidade só pode ser alterada em uma assinatura ativa.' });

    const currentCycle = (billing.billingCycle || 'MONTHLY') as BillingCycle;
    if (currentCycle === billingCycle) return res.status(200).json({ success: true, unchanged: true, message: 'A assinatura já utiliza esta periodicidade.' });

    const result = await changeBillingCycle(salonId, billingCycle as BillingCycle);
    return res.status(200).json({
      success: true,
      billingCycle,
      value: result.value,
      subscription: result.subscription,
      nextDueDate: result.subscription?.nextDueDate || billing.nextDueDate,
      message: 'Periodicidade atualizada. A nova condição será aplicada às próximas cobranças.'
    });
  } catch (error: any) {
    console.error('[Asaas Change Billing Cycle]', error);
    return res.status(Number(error?.statusCode) || 500).json({ error: error?.message || 'Não foi possível alterar a periodicidade da assinatura.' });
  }
}
