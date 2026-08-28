import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { asaasProvider } from '../../billing/AsaasProvider.js';
import { verifyIdToken, resolvePlatformAdmin } from '../../shared/auth.js';

type AsaasMode = 'sandbox' | 'production';

function resolveMode(rawMode: unknown, apiKey: string): AsaasMode | null {
  const mode = String(rawMode || '').trim().toLowerCase();
  if (mode === 'sandbox' || mode === 'production') return mode;
  // Sandbox keys use the $aact_hmlg_ prefix; production keys use $aact_prod_.
  if (apiKey.startsWith('$aact_hmlg_')) return 'sandbox';
  if (apiKey.startsWith('$aact_prod_')) return 'production';
  return null;
}

export default async function asaasTestConnectionHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    const adminDb = getAdminDb();
    let user;
    try { user = await verifyIdToken(req); }
    catch (err: any) { return res.status(401).json({ error: err.message || 'Não autorizado' }); }

    if (!(await resolvePlatformAdmin(user, adminDb))) {
      return res.status(403).json({ error: 'Acesso negado: apenas administradores da plataforma podem testar e alterar credenciais do Asaas.' });
    }

    const body = req.body || {};
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    const webhookToken = typeof body.webhookToken === 'string' ? body.webhookToken.trim() : '';
    if (!apiKey) return res.status(400).json({ error: 'API Key é obrigatória.' });

    const mode = resolveMode(body.mode, apiKey);
    if (!mode) {
      return res.status(400).json({ error: 'Ambiente Asaas inválido ou ausente. Selecione Sandbox ou Produção.' });
    }

    const expectedPrefix = mode === 'sandbox' ? '$aact_hmlg_' : '$aact_prod_';
    if (!apiKey.startsWith(expectedPrefix)) {
      return res.status(400).json({
        error: `A API Key não pertence ao ambiente selecionado. Para ${mode === 'sandbox' ? 'Sandbox' : 'Produção'}, a chave deve começar com ${expectedPrefix}.`,
        environment: mode
      });
    }

    try {
      await asaasProvider.testConnection(mode, apiKey);
    } catch (error: any) {
      const raw = String(error?.message || error);
      const status = Number(raw.match(/Asaas API Error:\s*(\d+)/i)?.[1] || 0);
      if (status === 401 || status === 403) {
        return res.status(400).json({
          error: 'A API Key foi rejeitada pelo Asaas. Confirme se ela foi gerada no mesmo ambiente e se continua ativa.',
          environment: mode,
          status
        });
      }
      return res.status(400).json({
        error: 'O Asaas não aceitou a conexão.',
        environment: mode,
        status: status || undefined,
        detail: raw.replace(/\$aact_[^\s"']+/g, '[REDACTED]')
      });
    }

    await adminDb.collection('settings').doc('asaas').set({
      mode,
      apiKey,
      ...(webhookToken ? { webhookToken } : {}),
      updatedAt: Date.now()
    }, { merge: true });

    return res.status(200).json({ message: 'Conectado com sucesso', environment: mode });
  } catch (error: any) {
    console.error('[Asaas Test] Error:', error);
    return res.status(500).json({ error: 'Não foi possível testar a conexão com o Asaas.' });
  }
}
