import { VercelRequest, VercelResponse } from '@vercel/node';
import { asaasProvider } from '../../billing/AsaasProvider.js';
import { commercialPlan, commercialPlanPrice, normalizePlanId } from '../../billing/commercialPlans.js';
import { env } from '../../config/env.js';
import { getAdminDb } from '../../shared/firebaseAdmin.js';
import { verifyIdToken, canManageBilling } from '../../shared/auth.js';

function toCycle(value: unknown): 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY' {
  const normalized = String(value || 'MONTHLY').toUpperCase();
  return normalized === 'SEMIANNUALLY' || normalized === 'YEARLY' ? normalized : 'MONTHLY';
}

function buildCustomerData(salonData: any) {
  const billing = salonData?.billing || {};
  return {
    name: billing.legalName || salonData?.name || 'Cliente LumièreOS',
    email: billing.email || salonData?.billingEmail || salonData?.ownerEmail || '',
    cpfCnpj: billing.document || salonData?.document || salonData?.cnpj || '',
    phone: billing.mobilePhone || salonData?.phone || salonData?.whatsapp || '',
    mobilePhone: billing.mobilePhone || salonData?.phone || salonData?.whatsapp || '',
    postalCode: billing.postalCode || salonData?.postalCode || '',
    address: billing.address || salonData?.address || '',
    addressNumber: billing.addressNumber || salonData?.addressNumber || '',
    complement: billing.complement || salonData?.complement || '',
    province: billing.province || salonData?.province || '',
    city: billing.city || salonData?.city || '',
  };
}

async function getSettings() {
  const db = getAdminDb();
  const doc = await db.collection('settings').doc('asaas').get();
  const data = doc.exists ? doc.data() || {} : {};
  return { mode: (data.mode || 'production') as 'sandbox' | 'production', apiKey: String(data.apiKey || env.asaas.apiKey || '') };
}

export default async function asaasUpdatePaymentMethodHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const body = req.body || {};
    const salonId = String(body.salonId || '');
    if (!salonId) return res.status(400).json({ error: 'Informe o salonId.' });

    let user;
    try { user = await verifyIdToken(req); }
    catch (err: any) { return res.status(401).json({ error: err.message || 'Não autorizado' }); }

    const db = getAdminDb();
    const salonRef = db.collection('salons').doc(salonId);
    const salonDoc = await salonRef.get();
    if (!salonDoc.exists) return res.status(404).json({ error: 'Salão não encontrado.' });
    const salonData = salonDoc.data() || {};
    const authResult = await canManageBilling(user, salonId, salonData);
    if (!authResult.authorized) return res.status(403).json({ error: authResult.reason || 'Sem permissão para alterar a forma de pagamento.' });

    const settings = await getSettings();
    if (!settings.apiKey) return res.status(500).json({ error: 'Asaas não está configurado.' });

    // A forma de pagamento não é escolhida no LumièreOS. O botão apenas abre
    // uma página hospedada pelo Asaas, onde o cliente escolhe Pix ou cartão.
    const subscriptionId = salonData?.billing?.subscriptionId || salonData?.providerSubscriptionId;
    if (subscriptionId) {
      const payments = await asaasProvider.getPaymentsBySubscription(settings.mode, settings.apiKey, subscriptionId);
      const pending = payments.find((p: any) => ['PENDING', 'OVERDUE'].includes(String(p.status || '').toUpperCase()));
      if (pending?.invoiceUrl) {
        return res.status(200).json({
          success: true,
          checkoutUrl: pending.invoiceUrl,
          authorizationUrl: pending.invoiceUrl,
          message: 'Abra o checkout seguro do Asaas para escolher ou atualizar a forma de pagamento.',
          billingType: 'UNDEFINED'
        });
      }
      return res.status(409).json({ error: 'Não existe uma cobrança aberta para configurar a forma de pagamento. A próxima cobrança será gerenciada pelo Asaas.' });
    }

    const isManualPaid = Boolean(salonData?.billingProvider === 'manual' || salonData?.billingProvider === 'manual_pix' || salonData?.paymentStatus === 'paid' || salonData?.lastPaymentAt || salonData?.billing?.lastPaymentDate);
    if (!isManualPaid) return res.status(409).json({ error: 'Esta conta ainda não possui assinatura Asaas nem pagamento manual identificado. Conclua o checkout inicial antes de configurar a forma de pagamento.' });

    const planId = normalizePlanId(String(body.planId || salonData?.billing?.planId || salonData?.plan || 'professional'));
    const plan = commercialPlan(planId);
    if (!plan) return res.status(404).json({ error: `Plano ${planId} não encontrado no catálogo comercial.` });
    const cycle = toCycle(body.billingCycle || salonData?.billing?.billingCycle || 'MONTHLY');
    const value = commercialPlanPrice(planId, cycle);
    const customerData = buildCustomerData(salonData);
    if (!customerData.cpfCnpj || !customerData.email || !customerData.name) {
      const appUrl = String(env.app.url || '').replace(/\/$/, '');
      const setupUrl = `${appUrl}/dashboard/dados-faturamento?salonId=${encodeURIComponent(salonId)}&planId=${encodeURIComponent(planId)}&billingCycle=${encodeURIComponent(cycle)}&migration=1`;
      return res.status(200).json({ success: true, requiresBillingData: true, authorizationUrl: setupUrl, setupUrl, message: 'Antes de configurar o pagamento, complete CPF/CNPJ, nome e e-mail em Dados de faturamento.' });
    }

    const appUrl = String(env.app.url || '').replace(/\/$/, '');
    const callback = {
      successUrl: `${appUrl}/dashboard/assinatura?payment=success&migration=1`,
      cancelUrl: `${appUrl}/dashboard/assinatura?payment=cancelled&migration=1`,
      expiredUrl: `${appUrl}/dashboard/assinatura?payment=expired&migration=1`,
      autoRedirect: true,
    };

    const checkout = await asaasProvider.createRecurringCheckout(settings.mode, settings.apiKey, {
      billingTypes: ['PIX', 'CREDIT_CARD'],
      minutesToExpire: 60,
      callback,
      externalReference: `manual-migration:${salonId}`,
      items: [{ name: `LumièreOS - ${plan.name}`, description: `Assinatura ${cycle.toLowerCase()} - migração de pagamento`, quantity: 1, value }],
      customerData,
      subscription: { cycle, nextDueDate: salonData?.billing?.nextDueDate || new Date().toISOString().split('T')[0] },
    });

    const checkoutUrl = checkout.link || checkout.url || null;
    await salonRef.update({
      'billing.pendingMigration': true,
      'billing.migrationSource': 'manual_payment',
      'billing.migrationPlanId': planId,
      'billing.migrationBillingCycle': cycle,
      'billing.migrationValue': value,
      'billing.migrationCheckoutId': checkout.id || null,
      'billing.migrationCheckoutUrl': checkoutUrl,
      'billing.updatedAt': new Date().toISOString(),
    });

    return res.status(200).json({ success: true, pendingMigration: true, checkoutUrl, authorizationUrl: checkoutUrl, billingCycle: cycle, value, message: 'Checkout seguro aberto. Escolha a forma de pagamento diretamente no Asaas.' });
  } catch (error: any) {
    console.error('[Asaas Update Payment Method]', error);
    return res.status(Number(error?.statusCode) || 500).json({ error: error?.message || 'Erro interno ao abrir o checkout de pagamento.' });
  }
}
