import { Request, Response } from 'express';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
// Initialize firebase admin if not already
import { getAdminAuth, getAdminDb } from '../../server/firebaseAdmin';

export default async function createSubscription(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação ausente.' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAdminAuth().verifyIdToken(idToken);
    } catch (error: any) {
      console.error('Firebase Auth verifyIdToken failed production-wide:', error.message || error);
      return res.status(401).json({ error: 'Token de autenticação inválido ou expirado.' });
    }

    const { salonId, plan } = req.body;
    if (!salonId || !plan) {
      return res.status(400).json({ error: 'Missing salonId or plan' });
    }

    const db = getAdminDb();

    // Validar permissão
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    if (!userData) {
      return res.status(403).json({ error: 'Você não tem permissão para criar assinatura para este salão.' });
    }

    const isPlatformAdmin = userData.role === 'platform_admin';
    const isOwnerOfSalon = userData.role === 'owner' && userData.salonId === salonId;
    
    // We can also allow managers if desired, but owner/admin is safer for billing
    if (!isPlatformAdmin && !isOwnerOfSalon) {
      return res.status(403).json({ error: 'Você não tem permissão para criar assinatura para este salão.' });
    }

    // Identificar valor do plano e validar
    const validPlans = ['founder', 'start', 'studio', 'performance', 'network'];
    const lowerPlan = plan.toLowerCase();
    
    if (!validPlans.includes(lowerPlan)) {
      return res.status(400).json({ error: 'Plano inválido.' });
    }

    const planKey = lowerPlan.toUpperCase();
    const amountStr = process.env[`MP_PLAN_${planKey}_AMOUNT`];
    let amount = amountStr ? parseFloat(amountStr) : 0;
    
    if (!amount || isNaN(amount)) {
      if (lowerPlan === 'founder') amount = 297;
      else if (lowerPlan === 'start') amount = 197;
      else if (lowerPlan === 'studio') amount = 397;
      else if (lowerPlan === 'performance') amount = 697;
      else if (lowerPlan === 'network') amount = 1497;
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('MERCADOPAGO_ACCESS_TOKEN is not configured');
      return res.status(502).json({ error: 'Não foi possível criar a assinatura no Mercado Pago.' });
    }

    const client = new MercadoPagoConfig({ accessToken });
    const preApproval = new PreApproval(client);

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const payerEmail = userData.email || decodedToken.email;

    let mpResponse;
    try {
      mpResponse = await preApproval.create({
        body: {
          reason: `Assinatura LumiéreOS - Plano ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
          external_reference: salonId,
          payer_email: payerEmail,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: amount,
            currency_id: 'BRL',
          },
          back_url: `${appUrl}/dashboard/assinatura?mp=success`,
          status: 'pending',
        }
      });
      if (!mpResponse || !mpResponse.init_point) {
        throw new Error('PreApproval response did not contain init_point');
      }
    } catch (mpError: any) {
      console.error('Mercado Pago API integration error:', mpError.message || mpError);
      return res.status(502).json({ error: 'Não foi possível criar a assinatura no Mercado Pago.' });
    }

    const preapprovalId = mpResponse.id;

    // Save initial state
    const batch = db.batch();
    
    const salonRef = db.collection('salons').doc(salonId);
    batch.update(salonRef, {
      billingProvider: 'mercadopago',
      mercadoPagoPreapprovalId: preapprovalId,
      subscriptionStatus: 'pending',
      paymentStatus: 'pending',
      updatedAt: new Date().toISOString()
    });

    const subscriptionRef = salonRef.collection('subscriptions').doc((preapprovalId as any).toString());
    batch.set(subscriptionRef, {
      provider: 'mercadopago',
      preapprovalId: (preapprovalId as any).toString(),
      status: 'pending',
      plan,
      amount,
      currency: 'BRL',
      initPoint: mpResponse.init_point,
      externalReference: salonId,
      createdBy: decodedToken.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    await batch.commit();

    return res.status(200).json({
      ok: true,
      preapprovalId,
      initPoint: mpResponse.init_point
    });

  } catch (error: any) {
    console.error('Error creating MP subscription:', error.message || error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
