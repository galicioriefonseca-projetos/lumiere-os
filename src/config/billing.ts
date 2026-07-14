export const BILLING_CONFIG = {
  pixKey: "leandropfonseca20@gmail.com",
  pixKeyType: "email",
  receiverName: "Galiciori e Fonseca Estratégia Digital",
  supportWhatsApp: "5517996140963",
  paymentInstructions: "Após realizar o pagamento via PIX, clique em Informar pagamento para nossa equipe validar sua assinatura.",
  
  // Asaas Configuration (DEPRECATED - Mantido apenas para compatibilidade histórica)
  /** @deprecated */
  asaas: {
    apiUrl: import.meta.env.VITE_ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3',
    // Configurações do comportamento do checkout
    chargeType: 'RECURRING', // Padrão recorrente
    paymentMethods: ['CREDIT_CARD', 'PIX'], // Métodos seguros aceitos
    sandboxMode: (import.meta.env.DEV === true) || (import.meta.env.VITE_CAKTO_SANDBOX_MODE === "true"), // Homologação ativa apenas em dev ou se explicitamente forçada por variável
  }
};

