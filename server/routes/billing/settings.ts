import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';

export default async function asaasSettingsHandler(req: VercelRequest, res: VercelResponse) {
  try {
    const adminDb = getAdminDb();
    
    if (req.method === 'GET') {
      const doc = await adminDb.collection('settings').doc('asaas').get();
      if (!doc.exists) {
        return res.status(200).json({
          mode: 'sandbox',
          apiKey: '',
          webhookToken: ''
        });
      }
      return res.status(200).json(doc.data());
    }

    if (req.method === 'POST') {
      const { action } = req.body;
      if (action === 'seed') {
        const plans = [
          { id: 'start', name: 'Start', description: 'Para salões que estão começando e precisam de gestão básica.', price: 197, billingCycle: 'MONTHLY', trialDays: 7, features: ['Até 5 profissionais', 'Agenda Integrada', 'Comandas', 'Cadastro de Clientes'], active: true, displayOrder: 1, color: '#3b82f6', maxProfessionals: 5 },
          { id: 'founder', name: 'Founder', description: 'Ideal para salões em crescimento.', price: 297, billingCycle: 'MONTHLY', trialDays: 7, features: ['Até 22 profissionais', 'Todos os recursos do Start', 'Relatórios Avançados'], active: true, displayOrder: 2, color: '#d4af37', badge: 'Mais Popular', maxProfessionals: 22 },
          { id: 'performance', name: 'Performance', description: 'Para salões de alto desempenho.', price: 397, billingCycle: 'MONTHLY', trialDays: 7, features: ['Até 40 profissionais', 'Dashboard Financeiro', 'Lumi (I.A)'], active: true, displayOrder: 3, color: '#8b5cf6', maxProfessionals: 40 },
          { id: 'network', name: 'Network', description: 'Para redes com múltiplas unidades.', price: 797, billingCycle: 'MONTHLY', trialDays: 7, features: ['Até 100 profissionais', 'Gestão Multi-unidade'], active: true, displayOrder: 4, color: '#ec4899', maxProfessionals: 100 },
          { id: 'enterprise', name: 'Enterprise', description: 'Operações em grande escala.', price: 1997, billingCycle: 'MONTHLY', trialDays: 0, features: ['Ilimitado', 'Suporte Dedicado'], active: true, displayOrder: 5, color: '#ef4444', maxProfessionals: 99999 }
        ];
        const batch = adminDb.batch();
        for (const plan of plans) {
          const ref = adminDb.collection('plans').doc(plan.id);
          batch.set(ref, { ...plan, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }
        await batch.commit();
        return res.status(200).json({ success: true, message: 'Plans seeded' });
      }

      const { mode, apiKey, webhookToken } = req.body;
      await adminDb.collection('settings').doc('asaas').set({
        mode,
        apiKey,
        webhookToken,
        updatedAt: Date.now()
      });
      return res.status(200).json({ message: 'Configurações salvas' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[Asaas Settings] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
