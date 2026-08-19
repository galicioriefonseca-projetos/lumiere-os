import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken, resolvePlatformAdmin } from '../../shared/auth.js';

const PLAN_CATALOG = [
  { id: 'essential', name: 'Essencial', description: 'Para profissionais e pequenos negócios que querem organizar toda a operação.', price: 197, semiannualPrice: 1064, annualPrice: 2009, billingCycle: 'MONTHLY', trialDays: 7, features: ['Até 5 profissionais', 'Agenda completa', 'Clientes e serviços', 'Comandas', 'Controle básico de caixa', 'Agendamento online', 'Dashboard operacional', 'Relatórios básicos', 'Suporte padrão'], active: true, displayOrder: 1, color: '#3b82f6', maxProfessionals: 5 },
  { id: 'professional', name: 'Profissional', description: 'Para negócios em crescimento que precisam de controle financeiro e gestão de equipe.', price: 397, semiannualPrice: 2144, annualPrice: 4049, billingCycle: 'MONTHLY', trialDays: 7, features: ['Tudo do Essencial', 'Até 15 profissionais', 'Financeiro completo', 'Fluxo de caixa', 'Contas a pagar e receber', 'Comissões e metas', 'CRM', 'Relatórios avançados', 'Dashboard de gestão', 'Suporte prioritário'], active: true, displayOrder: 2, color: '#d4af37', badge: 'Mais escolhido', maxProfessionals: 15 },
  { id: 'performance_plus', name: 'Performance', description: 'Para operações que querem inteligência, automação e decisões orientadas por dados.', price: 597, semiannualPrice: 3223, annualPrice: 6089, billingCycle: 'MONTHLY', trialDays: 7, features: ['Tudo do Profissional', 'Até 30 profissionais', 'Lumi — IA', 'Insights automáticos', 'Análises financeiras avançadas', 'Indicadores inteligentes', 'Análise de desempenho da equipe', 'Relatórios gerenciais avançados', 'Automação avançada', 'Suporte prioritário'], active: true, displayOrder: 3, color: '#8b5cf6', maxProfessionals: 30 },
  { id: 'multiunit', name: 'Multiunidade', description: 'Para grupos, redes e operações com múltiplas unidades.', price: 897, semiannualPrice: 4844, annualPrice: 9149, billingCycle: 'MONTHLY', trialDays: 7, features: ['Tudo do Performance', 'Até 60 profissionais por unidade', 'Gestão multiunidade', 'Dashboard consolidado', 'Comparação entre unidades', 'Financeiro por unidade', 'Relatórios executivos', 'Gestão centralizada', 'Permissões avançadas', 'Suporte VIP'], active: true, displayOrder: 4, color: '#ec4899', maxProfessionals: 60 },
  { id: 'enterprise_custom', name: 'Enterprise', description: 'Operações de grande porte com necessidades comerciais e técnicas personalizadas.', price: 0, billingCycle: 'MONTHLY', trialDays: 0, features: ['Tudo do Multiunidade', 'Implantação personalizada', 'Integrações avançadas', 'BI e relatórios personalizados', 'Gerente de conta', 'SLA e suporte dedicado'], active: true, displayOrder: 5, color: '#ef4444', badge: 'Sob consulta', customPricing: true, maxProfessionals: 999999 },
  { id: 'start', name: 'Start — legado', description: 'Plano legado. Não disponível para novas contratações.', price: 197, billingCycle: 'MONTHLY', trialDays: 7, features: ['Condições históricas preservadas'], active: false, displayOrder: 90, color: '#71717a', maxProfessionals: 5, legacy: true },
  { id: 'founder', name: 'Founder — legado', description: 'Condição comercial histórica. Não disponível para novas contratações.', price: 297, billingCycle: 'MONTHLY', trialDays: 7, features: ['Condições históricas preservadas'], active: false, displayOrder: 91, color: '#71717a', maxProfessionals: 22, legacy: true },
  { id: 'performance', name: 'Performance — legado', description: 'Condição comercial histórica. Não disponível para novas contratações.', price: 397, billingCycle: 'MONTHLY', trialDays: 7, features: ['Condições históricas preservadas'], active: false, displayOrder: 92, color: '#71717a', maxProfessionals: 40, legacy: true },
  { id: 'network', name: 'Network — legado', description: 'Condição comercial histórica. Não disponível para novas contratações.', price: 797, billingCycle: 'MONTHLY', trialDays: 7, features: ['Condições históricas preservadas'], active: false, displayOrder: 93, color: '#71717a', maxProfessionals: 100, legacy: true },
  { id: 'enterprise', name: 'Enterprise — legado', description: 'Condição comercial histórica. Não disponível para novas contratações.', price: 1997, billingCycle: 'MONTHLY', trialDays: 0, features: ['Condições históricas preservadas'], active: false, displayOrder: 94, color: '#71717a', maxProfessionals: 99999, legacy: true }
];

async function requirePlatformAdmin(req: VercelRequest, db: any) {
  try {
    const user = await verifyIdToken(req);
    if (!(await resolvePlatformAdmin(user, db))) return null;
    return user;
  } catch {
    return null;
  }
}

export default async function asaasSettingsHandler(req: VercelRequest, res: VercelResponse) {
  if (!['GET', 'POST'].includes(req.method || '')) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const adminDb = getAdminDb();
    const user = await requirePlatformAdmin(req, adminDb);
    if (!user) return res.status(403).json({ error: 'Acesso negado: apenas administradores da plataforma podem acessar estas configurações.' });

    if (req.method === 'GET') {
      const doc = await adminDb.collection('settings').doc('asaas').get();
      const data = doc.data() || {};
      return res.status(200).json({
        mode: data.mode || 'sandbox',
        productId: data.productId || '',
        startOfferId: data.startOfferId || '',
        founderOfferId: data.founderOfferId || '',
        performanceOfferId: data.performanceOfferId || '',
        networkOfferId: data.networkOfferId || '',
        enterpriseOfferId: data.enterpriseOfferId || ''
      });
    }

    const body = req.body || {};
    if (body.action === 'seed') {
      const batch = adminDb.batch();
      const now = new Date().toISOString();
      for (const plan of PLAN_CATALOG) batch.set(adminDb.collection('plans').doc(plan.id), { ...plan, updatedAt: now }, { merge: true });
      await batch.commit();
      return res.status(200).json({ success: true, message: 'Catálogo comercial atual sincronizado.' });
    }

    const mode = String(body.mode || '').toLowerCase();
    if (mode && mode !== 'sandbox' && mode !== 'production') return res.status(400).json({ error: 'Modo Asaas inválido.' });

    const updateData: any = { updatedAt: Date.now() };
    if (mode) updateData.mode = mode;
    if (typeof body.apiKey === 'string' && body.apiKey.trim()) updateData.apiKey = body.apiKey.trim();
    if (typeof body.webhookToken === 'string' && body.webhookToken.trim()) updateData.webhookToken = body.webhookToken.trim();

    for (const key of ['productId', 'startOfferId', 'founderOfferId', 'performanceOfferId', 'networkOfferId', 'enterpriseOfferId']) {
      if (body[key] !== undefined) updateData[key] = String(body[key] || '').trim();
    }

    await adminDb.collection('settings').doc('asaas').set(updateData, { merge: true });
    return res.status(200).json({ success: true, message: 'Configurações salvas.' });
  } catch (error: any) {
    console.error('[Asaas Settings] Error:', error);
    return res.status(500).json({ error: 'Não foi possível processar as configurações do Asaas.' });
  }
}
