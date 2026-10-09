const readPublicEnv = (key: string, fallback = '') => {
  return typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env[key] || fallback : fallback;
};

export const OFFICIAL_SUPPORT_WHATSAPP = '5517996140963';
export const OFFICIAL_SUPPORT_PHONE_DISPLAY = '(17) 99614-0963';

export const BILLING_CONFIG = {
  pixKey: readPublicEnv('VITE_BILLING_PIX_KEY', ''),
  pixKeyType: readPublicEnv('VITE_BILLING_PIX_KEY_TYPE', ''),
  receiverName: readPublicEnv('VITE_BILLING_RECEIVER_NAME', ''),
  supportWhatsApp: readPublicEnv('VITE_SUPPORT_WHATSAPP', OFFICIAL_SUPPORT_WHATSAPP),
  supportEmail: readPublicEnv('VITE_SUPPORT_EMAIL', 'suporte@lumiereos.com.br'),
  paymentInstructions: readPublicEnv('VITE_BILLING_PAYMENT_INSTRUCTIONS', 'Após realizar o pagamento via PIX, clique em Informar pagamento para nossa equipe validar sua assinatura.')
};
