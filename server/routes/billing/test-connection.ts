import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { billingService } from '../../billing/BillingService.js';
import { verifyIdToken, resolvePlatformAdmin } from '../../shared/auth.js';

export default async function asaasTestConnectionHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const adminDb = getAdminDb();

    // 1. Verificação de Autenticação
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (err: any) {
      return res.status(401).json({ error: err.message || 'Não autorizado' });
    }

    // 2. Verificação de Autorização (Platform Admin)
    const isPlatformAdmin = await resolvePlatformAdmin(user, adminDb);
    if (!isPlatformAdmin) {
      return res.status(403).json({ error: 'Acesso negado: apenas administradores da plataforma podem testar e alterar credenciais do Asaas.' });
    }

    const { mode, apiKey, webhookToken } = req.body || {};
    if (!apiKey) {
      return res.status(400).json({ error: 'API Key é obrigatória' });
    }

    const isConnected = await billingService.testConnection({ mode, apiKey, webhookToken });
    
    if (isConnected) {
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
