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

    let { mode, apiKey, webhookToken } = req.body || {};
    if (!apiKey) {
      const savedDoc = await adminDb.collection('settings').doc('asaas').get();
      const saved = savedDoc.data() || {};
      apiKey = saved.apiKey;
      if (!mode) mode = saved.mode;
      if (!webhookToken) webhookToken = saved.webhookToken;
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'API Key é obrigatória' });
    }

    let cleanKey = String(apiKey).trim();
    const secondIndex = cleanKey.indexOf('$aact_', 1);
    if (secondIndex > 0) cleanKey = cleanKey.slice(0, secondIndex).trim();

    if (!mode) {
      mode = cleanKey.startsWith('$aact_prod_') ? 'production' : 'sandbox';
    } else if (cleanKey.startsWith('$aact_hmlg_')) {
      mode = 'sandbox';
    } else if (cleanKey.startsWith('$aact_prod_')) {
      mode = 'production';
    }

    const isConnected = await billingService.testConnection({ mode, apiKey: cleanKey, webhookToken });
    
    if (isConnected) {
      await adminDb.collection('settings').doc('asaas').set({
        mode,
        apiKey: cleanKey,
        webhookToken: webhookToken || '',
        updatedAt: Date.now()
      }, { merge: true });
      return res.status(200).json({ message: 'Conectado com sucesso' });
    } else {
      return res.status(400).json({ error: 'Credenciais inválidas' });
    }
  } catch (error: any) {
    console.error('[Asaas Test] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
