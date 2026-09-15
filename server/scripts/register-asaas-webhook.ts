import { getAdminDb } from '../shared/firebaseAdmin.js';
import { env } from '../config/env.js';

export const ASAAS_WEBHOOK_EVENTS = [
  // Pagamentos e Cobranças
  'PAYMENT_CREATED',
  'PAYMENT_AWAITING_RISK_ANALYSIS',
  'PAYMENT_APPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_AUTHORIZED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_RECEIVED',
  'PAYMENT_PARTIALLY_REFUNDED',
  'PAYMENT_REFUNDED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_RESTORED',
  'PAYMENT_CHARGEBACK_REQUESTED',
  'PAYMENT_CHARGEBACK_DISPUTE',
  'PAYMENT_AWAITING_CHARGEBACK_REVERSAL',
  'PAYMENT_DUNNING_RECEIVED',
  'PAYMENT_DUNNING_REQUESTED',
  'PAYMENT_BANK_SLIP_CANCELLED',
  // Checkout Asaas
  'CHECKOUT_CREATED',
  'CHECKOUT_PAID',
  'CHECKOUT_CANCELED',
  'CHECKOUT_EXPIRED',
  // Assinaturas
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_INACTIVATED',
  'SUBSCRIPTION_DELETED'
];

export interface RegisterWebhookOptions {
  url?: string;
  email?: string;
  name?: string;
}

export interface RegisterWebhookResult {
  success: boolean;
  action: 'created' | 'updated';
  webhookId: string;
  url: string;
  mode: 'sandbox' | 'production';
  details: any;
}

/**
 * Registra ou atualiza automaticamente o Webhook no Asaas utilizando as credenciais configuradas
 * no Firestore (settings/asaas) e garantindo a remoção de qualquer penalização/backoff.
 */
export async function registerAsaasWebhook(options?: RegisterWebhookOptions): Promise<RegisterWebhookResult> {
  const adminDb = getAdminDb();
  const settingsDoc = await adminDb.collection('settings').doc('asaas').get();
  const settings = settingsDoc.data() || {};

  const mode: 'sandbox' | 'production' = settings.mode === 'production' ? 'production' : 'sandbox';
  const apiKey = (typeof settings.apiKey === 'string' && !settings.apiKey.includes('*') ? settings.apiKey.trim() : '') ||
                 (typeof env.asaas.apiKey === 'string' ? env.asaas.apiKey.trim() : '');
  const webhookToken = (typeof settings.webhookToken === 'string' && !settings.webhookToken.includes('*') ? settings.webhookToken.trim() : '') ||
                       (typeof env.asaas.webhookToken === 'string' ? env.asaas.webhookToken.trim() : '');

  if (!apiKey) {
    throw new Error('Chave de API do Asaas não configurada. Configure a apiKey antes de registrar o webhook.');
  }

  if (!webhookToken) {
    throw new Error('Token de Webhook do Asaas não configurado. Configure o webhookToken antes de registrar o webhook.');
  }

  const appBaseUrl = (options?.url || env.app.url || 'https://lumiere-os.vercel.app').replace(/\/+$/, '');
  const webhookUrl = `${appBaseUrl}/api/billing/webhook`;
  const webhookEmail = options?.email || env.app.platformAdminEmail || 'contato@lumiereos.com.br';
  const webhookName = options?.name || `LumièreOS ${mode === 'production' ? 'Produção' : 'Sandbox'}`;

  const baseUrl = mode === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
  const headers = {
    'Content-Type': 'application/json',
    'access_token': apiKey,
    'User-Agent': 'LumiereOS-Migration/1.0'
  };

  console.log(`[Asaas Migration] Verificando webhooks configurados em modo ${mode.toUpperCase()}...`);
  console.log(`[Asaas Migration] URL Alvo: ${webhookUrl}`);

  // 1. Listar webhooks existentes
  const listRes = await fetch(`${baseUrl}/webhooks`, { headers });
  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Falha ao consultar webhooks no Asaas (${listRes.status}): ${errText}`);
  }

  const listData = await listRes.json().catch(() => ({ data: [] }));
  const existingWebhooks: any[] = listData.data || [];

  // Encontrar webhook correspondente por URL ou nome
  let matchedWebhook = existingWebhooks.find((w) => w.url === webhookUrl) ||
                       existingWebhooks.find((w) => w.name?.toLowerCase().includes('lumière') || w.name?.toLowerCase().includes('lumiere')) ||
                       existingWebhooks[0];

  let webhookId = '';
  let action: 'created' | 'updated' = 'updated';
  let webhookResult: any = null;

  const payload = {
    name: webhookName,
    url: webhookUrl,
    email: webhookEmail,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken: webhookToken,
    sendType: 'SEQUENTIALLY',
    events: ASAAS_WEBHOOK_EVENTS
  };

  if (matchedWebhook?.id) {
    webhookId = matchedWebhook.id;
    action = 'updated';
    console.log(`[Asaas Migration] Atualizando webhook existente (ID: ${webhookId})...`);

    const updateRes = await fetch(`${baseUrl}/webhooks/${webhookId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`Falha ao atualizar webhook no Asaas (${updateRes.status}): ${errText}`);
    }

    webhookResult = await updateRes.json().catch(() => ({ id: webhookId }));
  } else {
    action = 'created';
    console.log(`[Asaas Migration] Criando novo webhook no Asaas...`);

    const createRes = await fetch(`${baseUrl}/webhooks`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Falha ao criar webhook no Asaas (${createRes.status}): ${errText}`);
    }

    webhookResult = await createRes.json();
    webhookId = webhookResult.id;
  }

  // 2. Remover penalização / backoff para garantir que eventos em fila sejam despachados imediatamente
  try {
    console.log(`[Asaas Migration] Solicitando remoção de backoff/penalização para ID: ${webhookId}...`);
    const removeBackoffRes = await fetch(`${baseUrl}/webhooks/${webhookId}/removeBackoff`, {
      method: 'POST',
      headers
    });
    if (removeBackoffRes.ok || removeBackoffRes.status === 204) {
      console.log(`[Asaas Migration] Backoff/penalização removido com sucesso. Fila liberada para tempo real!`);
    } else {
      console.warn(`[Asaas Migration] Aviso ao remover backoff (${removeBackoffRes.status}): ${await removeBackoffRes.text()}`);
    }
  } catch (backoffErr) {
    console.warn('[Asaas Migration] Falha não crítica ao chamar removeBackoff:', backoffErr);
  }

  // 3. Salvar metadados do Webhook no Firestore para rastreabilidade
  await adminDb.collection('settings').doc('asaas').set({
    webhookId,
    webhookUrl,
    webhookStatus: 'ACTIVE',
    webhookRegisteredAt: Date.now(),
    updatedAt: Date.now()
  }, { merge: true });

  console.log(`[Asaas Migration] Sucesso! Webhook registrado e sincronizado no Firestore.`);

  return {
    success: true,
    action,
    webhookId,
    url: webhookUrl,
    mode,
    details: webhookResult
  };
}

// Execução direta via CLI (npx tsx server/scripts/register-asaas-webhook.ts)
const isDirectRun = process.argv[1]?.endsWith('register-asaas-webhook.ts') ||
                    process.argv[1]?.endsWith('register-asaas-webhook.js');

if (isDirectRun) {
  registerAsaasWebhook()
    .then((result) => {
      console.log('\n==================================================');
      console.log('🎉 REGISTRO DE WEBHOOK ASAAS CONCLUÍDO COM SUCESSO');
      console.log('==================================================');
      console.log(`• Ação:           ${result.action.toUpperCase()}`);
      console.log(`• Webhook ID:     ${result.webhookId}`);
      console.log(`• Modo:           ${result.mode.toUpperCase()}`);
      console.log(`• URL Registrada: ${result.url}`);
      console.log(`• Status Fila:    ATIVO (Sem penalização)`);
      console.log('==================================================\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ ERRO NO REGISTRO DO WEBHOOK ASAAS:', err.message);
      process.exit(1);
    });
}
