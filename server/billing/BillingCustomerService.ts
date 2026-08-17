import { getAdminDb } from '../shared/firebaseAdmin.js';
import { asaasProvider } from './AsaasProvider.js';

export interface BillingCustomerData {
  document: string;
  documentType: 'CPF' | 'CNPJ';
  legalName: string;
  email: string;
  mobilePhone: string;
}

function onlyDigits(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^([0-9])\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
}

function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^([0-9])\1+$/.test(cnpj)) return false;
  const calc = (length: number) => {
    const weights = length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += Number(cnpj[i]) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

export function normalizeBillingCustomerData(input: any): BillingCustomerData {
  const document = onlyDigits(input?.document || input?.cpfCnpj);
  const documentType = document.length === 11 ? 'CPF' : document.length === 14 ? 'CNPJ' : null;
  if (!documentType) throw new Error('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
  if (documentType === 'CPF' && !isValidCpf(document)) throw new Error('O CPF informado é inválido.');
  if (documentType === 'CNPJ' && !isValidCnpj(document)) throw new Error('O CNPJ informado é inválido.');

  const legalName = String(input?.legalName || input?.name || '').trim();
  const email = String(input?.email || '').trim().toLowerCase();
  const mobilePhone = onlyDigits(input?.mobilePhone || input?.phone || input?.whatsapp);
  if (legalName.length < 2) throw new Error('Informe o nome completo ou razão social.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Informe um e-mail de cobrança válido.');
  if (mobilePhone.length < 10) throw new Error('Informe um telefone de cobrança válido.');

  return { document, documentType, legalName, email, mobilePhone };
}

export async function saveBillingCustomerData(salonId: string, input: any) {
  const data = normalizeBillingCustomerData(input);
  const db = getAdminDb();
  const salonRef = db.collection('salons').doc(salonId);
  const salonSnap = await salonRef.get();
  if (!salonSnap.exists) throw new Error('Salão não encontrado.');

  const salon = salonSnap.data() || {};
  const settingsSnap = await db.collection('settings').doc('asaas').get();
  const settings = settingsSnap.data() || {};
  const mode = settings.mode || 'production';
  const apiKey = settings.apiKey;
  if (!apiKey) throw new Error('Integração Asaas não configurada.');

  const customerId = salon.billing?.customerId || salon.asaasCustomerId;
  let asaasCustomerId = customerId;

  const customerPayload = {
    name: data.legalName,
    email: data.email,
    cpfCnpj: data.document,
    mobilePhone: data.mobilePhone,
    externalReference: salonId
  };

  if (customerId) {
    await asaasProvider.updateCustomer(mode, apiKey, customerId, customerPayload);
  } else {
    const customer = await asaasProvider.createCustomer(mode, apiKey, customerPayload);
    asaasCustomerId = customer.id;
  }

  await salonRef.update({
    billing: {
      ...(salon.billing || {}),
      provider: 'asaas',
      customerId: asaasCustomerId,
      document: data.document,
      documentType: data.documentType,
      legalName: data.legalName,
      email: data.email,
      mobilePhone: data.mobilePhone,
      updatedAt: new Date().toISOString()
    },
    asaasCustomerId: asaasCustomerId,
    billingEmail: data.email,
    updatedAt: Date.now()
  });

  return { ...data, customerId: asaasCustomerId };
}

export async function getBillingCustomerData(salonId: string) {
  const db = getAdminDb();
  const snap = await db.collection('salons').doc(salonId).get();
  if (!snap.exists) throw new Error('Salão não encontrado.');
  const data = snap.data() || {};
  const billing = data.billing || {};
  return {
    document: billing.document || data.document || data.cnpj || '',
    documentType: billing.documentType || '',
    legalName: billing.legalName || data.name || '',
    email: billing.email || data.billingEmail || data.ownerEmail || '',
    mobilePhone: billing.mobilePhone || data.phone || data.whatsapp || '',
    customerId: billing.customerId || data.asaasCustomerId || null,
    complete: Boolean(billing.document || data.document || data.cnpj)
  };
}
