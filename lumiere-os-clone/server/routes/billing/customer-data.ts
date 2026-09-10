import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';
import { getBillingCustomerData, saveBillingCustomerData } from '../../billing/BillingCustomerService.js';

export default async function customerDataHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ success: false, error: 'Método não permitido. Utilize GET ou POST.' });
  }

  try {
    const user = await verifyIdToken(req);
    const salonId = String(req.method === 'GET' ? req.query.salonId || '' : req.body?.salonId || '').trim();
    if (!salonId) return res.status(400).json({ success: false, error: 'Informe salonId.' });

    const db = getAdminDb();
    const salonDoc = await db.collection('salons').doc(salonId).get();
    if (!salonDoc.exists) return res.status(404).json({ success: false, error: 'Salão não encontrado.' });

    const authResult = await canManageBilling(user, salonId, salonDoc.data());
    if (!authResult.authorized) {
      return res.status(403).json({ success: false, error: authResult.reason || 'Sem permissão de faturamento.' });
    }

    if (req.method === 'GET') {
      return res.status(200).json({ success: true, data: await getBillingCustomerData(salonId) });
    }

    const data = await saveBillingCustomerData(salonId, req.body || {});
    return res.status(200).json({ success: true, message: 'Dados de faturamento salvos e sincronizados com a Asaas.', data });
  } catch (error: any) {
    console.error('[Billing Customer Data] Error:', error);
    const message = error?.message || 'Erro interno ao salvar dados de faturamento.';
    const status = /CPF|CNPJ|nome|e-mail|telefone|válido|valid/i.test(message) ? 422 : 500;
    return res.status(status).json({ success: false, error: message });
  }
}
