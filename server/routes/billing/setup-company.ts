import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken } from '../../shared/auth.js';

function mapBusinessType(segment: string): string {
  switch (segment) {
    case 'Barbearia': return 'barbershop';
    case 'Clínica de Estética': return 'clinic';
    case 'Estúdio': return 'studio';
    case 'Outro': return 'other';
    default: return 'salon';
  }
}

/**
 * GET /api/billing/setup-token?token=...
 * Valida se um token de sessão única para configuração da empresa é válido e não foi usado.
 */
export async function validateSetupTokenHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== 'GET') {
    if (typeof res.setHeader === 'function') res.setHeader('Allow', 'GET');
    return res.status(405).json({ valid: false, error: 'Método não permitido. Utilize GET.' });
  }

  try {
    const token = String(req.query.token || '').trim();
    if (!token) {
      return res.status(400).json({ valid: false, error: 'Token de configuração não fornecido.' });
    }

    const adminDb = getAdminDb();
    const tokenDoc = await adminDb.collection('setup_tokens').doc(token).get();

    if (!tokenDoc.exists) {
      return res.status(404).json({ valid: false, error: 'Token de configuração inválido ou não encontrado.' });
    }

    const data = tokenDoc.data();
    if (data?.used === true) {
      return res.status(410).json({ valid: false, error: 'Este link de configuração já foi utilizado.', alreadyUsed: true });
    }

    if (data?.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
      return res.status(410).json({ valid: false, error: 'Este link de configuração expirou. Solicite um novo link.', expired: true });
    }

    let salonName = '';
    let ownerName = '';
    if (data?.salonId) {
      const salonSnap = await adminDb.collection('salons').doc(data.salonId).get();
      if (salonSnap.exists) {
        const s = salonSnap.data();
        salonName = s?.name || '';
        ownerName = s?.ownerName || '';
      }
    }

    return res.status(200).json({
      valid: true,
      salonId: data?.salonId || '',
      email: data?.email || '',
      ownerId: data?.ownerId || '',
      salonName,
      ownerName
    });
  } catch (err: any) {
    console.error('[Setup Token] Erro ao validar token:', err);
    return res.status(500).json({ valid: false, error: 'Erro interno ao validar token.' });
  }
}

/**
 * POST /api/billing/complete-setup
 * Conclui a configuração da empresa após o pagamento.
 * Pode ser acionado tanto via token de sessão única (do e-mail do Resend)
 * quanto por usuário autenticado na sessão.
 */
export async function completeCompanySetupHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== 'POST') {
    if (typeof res.setHeader === 'function') res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const adminDb = getAdminDb();
    const body = req.body || {};
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const salonName = String(body.salonName || '').trim();
    const businessSegment = String(body.businessSegment || '').trim();
    const city = String(body.city || '').trim();
    const state = String(body.state || '').trim().toUpperCase();
    const estimatedProfessionals = String(body.estimatedProfessionals || '');

    if (!salonName || !city || !state || !businessSegment) {
      return res.status(422).json({
        success: false,
        error: 'Preencha todos os campos obrigatórios (nome, segmento, cidade e estado).'
      });
    }

    let targetSalonId = '';
    let targetOwnerId = '';

    // 1. Se forneceu token de sessão única
    if (token) {
      const tokenRef = adminDb.collection('setup_tokens').doc(token);
      const tokenSnap = await tokenRef.get();

      if (!tokenSnap.exists) {
        return res.status(404).json({ success: false, error: 'Token de configuração inválido ou não encontrado.' });
      }

      const tokenData = tokenSnap.data();
      if (tokenData?.used === true) {
        return res.status(410).json({ success: false, error: 'Este link de configuração já foi utilizado.' });
      }

      if (tokenData?.expiresAt && new Date(tokenData.expiresAt).getTime() < Date.now()) {
        return res.status(410).json({ success: false, error: 'Este link de configuração expirou.' });
      }

      targetSalonId = tokenData?.salonId || '';
      targetOwnerId = tokenData?.ownerId || '';

      // Invalida o token para garantir uso estritamente único
      await tokenRef.update({
        used: true,
        usedAt: new Date().toISOString()
      });
    } else {
      // 2. Se não forneceu token, requer autenticação
      const decodedUser = await verifyIdToken(req);
      const userSnap = await adminDb.collection('users').doc(decodedUser.uid).get();
      if (!userSnap.exists) {
        return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
      }
      const userData = userSnap.data();
      targetSalonId = userData?.salonId || '';
      targetOwnerId = decodedUser.uid;
    }

    if (!targetSalonId) {
      return res.status(400).json({ success: false, error: 'Identificador do estabelecimento não encontrado.' });
    }

    const maxPros = parseInt(estimatedProfessionals.split(' ')[0]) || 5;
    const now = Date.now();

    // Atualiza salão no Firestore
    const salonRef = adminDb.collection('salons').doc(targetSalonId);
    await salonRef.set({
      name: salonName,
      businessType: mapBusinessType(businessSegment),
      city,
      state,
      maxProfessionals: maxPros,
      status: 'active',
      subscriptionStatus: 'active',
      activationStatus: 'active',
      isActive: true,
      onboardingCompleted: true,
      onboardingStatus: 'completed',
      setupToken: { used: true, completedAt: new Date(now).toISOString() },
      updatedAt: now
    }, { merge: true });

    // Atualiza o perfil do proprietário
    if (targetOwnerId) {
      const userRef = adminDb.collection('users').doc(targetOwnerId);
      await userRef.set({
        role: 'owner',
        onboardingStatus: 'completed',
        updatedAt: now
      }, { merge: true });
    }

    return res.status(200).json({
      success: true,
      salonId: targetSalonId,
      message: 'Empresa configurada com sucesso!'
    });
  } catch (err: any) {
    console.error('[Setup Company] Erro ao concluir configuração da empresa:', err);
    return res.status(500).json({ success: false, error: err.message || 'Erro interno ao salvar dados da empresa.' });
  }
}
