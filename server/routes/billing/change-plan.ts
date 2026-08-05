import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { billingService } from '../../billing/BillingService.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';

export default async function asaasChangePlanHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const { salonId, planId, action } = req.body || {};

    if (!salonId) {
      return res.status(400).json({ error: 'salonId é obrigatório' });
    }

    // 1. Verificação de Autenticação
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (err: any) {
      return res.status(401).json({ error: err.message || 'Não autorizado' });
    }

    // 2. Buscar documento do salão para autorização multi-tenant
    const adminDb = getAdminDb();
    const salonDoc = await adminDb.collection('salons').doc(salonId).get();
    
    if (!salonDoc.exists) {
      return res.status(404).json({ error: 'Salão não encontrado' });
    }

    // 3. Verificação de Autorização de Faturamento
    const authResult = await canManageBilling(user, salonId, salonDoc.data());
    if (!authResult.authorized) {
      return res.status(403).json({ error: authResult.reason || 'Sem permissão para alterar o plano deste salão.' });
    }

    if (action === 'cancel') {
      await adminDb.collection('salons').doc(salonId).update({
        pendingPlanChange: null
      });
      return res.status(200).json({ success: true, message: 'Agendamento cancelado.' });
    }

    if (action === 'schedule' || action === 'change') {
      if (!planId) {
        return res.status(400).json({ error: 'planId é obrigatório para alterar ou agendar plano' });
      }
      // Using BillingService to change the plan in Asaas
      const sub = await billingService.changePlan(salonId, planId);
      
      return res.status(200).json({ success: true, message: 'Plano alterado com sucesso no Asaas.', subscription: sub });
    }

    return res.status(400).json({ error: 'Ação inválida' });
  } catch (error: any) {
    console.error('[Asaas Change Plan]', error);
    return res.status(500).json({ error: error.message });
  }
}
