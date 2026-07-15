const readPublicEnv = (key: string, fallback = ""): string => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return value?.trim() || fallback;
};

export const BILLING_CONFIG = {
  pixKey: readPublicEnv("VITE_BILLING_PIX_KEY"),
  pixKeyType: readPublicEnv("VITE_BILLING_PIX_KEY_TYPE", "email"),
  receiverName: readPublicEnv("VITE_BILLING_RECEIVER_NAME", "LumièreOS"),
  supportWhatsApp: readPublicEnv("VITE_SUPPORT_WHATSAPP"),
  supportEmail: readPublicEnv("VITE_SUPPORT_EMAIL"),
  paymentInstructions: readPublicEnv(
    "VITE_BILLING_PAYMENT_INSTRUCTIONS",
    "Após realizar o pagamento manual, informe o comprovante para validação da assinatura."
  ),
};
