import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { billingService } from '../../billing/BillingService.js';

export default async function asaasTestConnectionHandler(req: VercelRequest, res: VercelResponse) {
  try {
    const { mode, apiKey, webhookToken } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: 'API Key é obrigatória' });
    }

    const isConnected = await billingService.testConnection({ mode, apiKey, webhookToken });
    
    if (isConnected) {
      const adminDb = getAdminDb();
      await adminDb.collection('settings').doc('asaas').set({
        mode,
        apiKey,
        webhookToken,
        updatedAt: Date.now()
      });
      return res.status(200).json({ message: 'Conectado com sucesso' });
    } else {
      return res.status(400).json({ error: 'Credenciais inválidas' });
    }
  } catch (error: any) {
    console.error('[Asaas Test] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
