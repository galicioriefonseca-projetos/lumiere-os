import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken, resolvePlatformAdmin } from '../../shared/auth.js';

export default async function asaasSettingsHandler(req: VercelRequest, res: VercelResponse) {
  try {
    const adminDb = getAdminDb();
    
    if (req.method === 'GET') {
      let decodedToken;
      try {
        decodedToken = await verifyIdToken(req);
      } catch (err: any) {
        return res.status(401).json({ error: err.message || 'Não autorizado' });
      }

      const isPlatformAdmin = await resolvePlatformAdmin(decodedToken, adminDb);
      if (!isPlatformAdmin) {
        return res.status(403).json({ error: 'Acesso negado: apenas administradores da plataforma podem ler estas configurações.' });
      }

      const doc = await adminDb.collection('settings').doc('asaas').get();
      if (!doc.exists) {
        return res.status(200).json({
          mode: 'sandbox',
          productId: '',
          startOfferId: '',
          founderOfferId: '',
          performanceOfferId: '',
          networkOfferId: '',
          enterpriseOfferId: ''
        });
      }
      
      const data = doc.data() || {};
      
      // Selectively return public fields
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

    if (req.method === 'POST') {
      let decodedToken;
      try {
        decodedToken = await verifyIdToken(req);
      } catch (err: any) {
        return res.status(401).json({ error: err.message || 'Não autorizado' });
      }

      const isPlatformAdmin = await resolvePlatformAdmin(decodedToken, adminDb);
      if (!isPlatformAdmin) {
        return res.status(403).json({ error: 'Acesso negado: apenas administradores da plataforma podem alterar as configurações.' });
      }

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
      
      const { 
        mode, 
        apiKey, 
        webhookToken,
        productId,
        startOfferId,
        founderOfferId,
        performanceOfferId,
        networkOfferId,
        enterpriseOfferId
      } = req.body;
      
      const updateData: any = {
        mode,
        updatedAt: Date.now()
      };
      
      // Update secrets only if provided
      if (apiKey && apiKey.trim() !== '') updateData.apiKey = apiKey;
      if (webhookToken && webhookToken.trim() !== '') updateData.webhookToken = webhookToken;
      
      // Update IDs if provided
      if (productId !== undefined) updateData.productId = productId;
      if (startOfferId !== undefined) updateData.startOfferId = startOfferId;
      if (founderOfferId !== undefined) updateData.founderOfferId = founderOfferId;
      if (performanceOfferId !== undefined) updateData.performanceOfferId = performanceOfferId;
      if (networkOfferId !== undefined) updateData.networkOfferId = networkOfferId;
      if (enterpriseOfferId !== undefined) updateData.enterpriseOfferId = enterpriseOfferId;
      
      await adminDb.collection('settings').doc('asaas').set(updateData, { merge: true });

      return res.status(200).json({ message: 'Configurações salvas' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('[Asaas Settings] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
