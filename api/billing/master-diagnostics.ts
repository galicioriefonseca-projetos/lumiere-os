import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../../server/shared/firebaseAdmin.js';
import { verifyIdToken, resolvePlatformAdmin } from '../../server/shared/auth.js';

const BILLING_STATUSES = ['ACTIVE', 'PENDING_PAYMENT', 'OVERDUE', 'CANCELLED'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido. Utilize GET.' });
  }

  try {
    const user = await verifyIdToken(req);
    const db = getAdminDb();
    if (!(await resolvePlatformAdmin(user, db))) return res.status(403).json({ error: 'Acesso restrito ao Platform Admin.' });

    const salonsSnap = await db.collection('salons').get();
    const counts: Record<string, number> = { TOTAL: salonsSnap.size };
    for (const status of BILLING_STATUSES) counts[status] = 0;

    let configured = 0;
    let withSubscription = 0;
    let manualMigration = 0;
    let missingNextDueDate = 0;
    let missingPlan = 0;

    salonsSnap.forEach(doc => {
      const data = doc.data() || {};
      const billing = data.billing || {};
      const status = String(billing.status || data.subscriptionStatus || '').toUpperCase();
      if (BILLING_STATUSES.includes(status)) counts[status]++;
      if (billing.customerId || data.asaasCustomerId) configured++;
      if (billing.subscriptionId) withSubscription++;
      if (billing.pendingMigration || data.billingRequiresMigration) manualMigration++;
      if (!billing.nextDueDate && billing.subscriptionId) missingNextDueDate++;
      if (!billing.planId && billing.subscriptionId) missingPlan++;
    });

    const eventsSnap = await db.collection('billing_events').get();
    let processedEvents = 0;
    let failedEvents = 0;
    eventsSnap.forEach(doc => {
      const data = doc.data() || {};
      if (data.processed === true || data.status === 'PROCESSED') processedEvents++;
      if (data.dlq === true || data.status === 'DLQ') failedEvents++;
    });

    const dlqSnap = await db.collection('billing_dlq').get();
    let unresolvedDlq = 0;
    dlqSnap.forEach(doc => { if (doc.data()?.resolved !== true) unresolvedDlq++; });

    const settingsSnap = await db.collection('settings').doc('asaas').get();
    const settings = settingsSnap.data() || {};

    return res.status(200).json({
      success: true,
      generatedAt: new Date().toISOString(),
      asaas: {
        configured: Boolean(settings.apiKey),
        mode: settings.mode || 'sandbox',
        webhookConfigured: Boolean(settings.webhookToken),
      },
      salons: { ...counts, withCustomer: configured, withSubscription, manualMigration, missingNextDueDate, missingPlan },
      webhooks: { totalEvents: eventsSnap.size, processedEvents, failedEvents, unresolvedDlq },
      health: {
        billingConfigured: Boolean(settings.apiKey),
        webhookConfigured: Boolean(settings.webhookToken),
        hasUnresolvedDlq: unresolvedDlq > 0,
        hasIncompleteSubscriptions: missingNextDueDate > 0 || missingPlan > 0,
      },
    });
  } catch (error: any) {
    console.error('[Master Billing Diagnostics]', error);
    return res.status(500).json({ error: error?.message || 'Falha ao gerar diagnóstico financeiro.' });
  }
}
