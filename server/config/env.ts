import dotenv from 'dotenv';

dotenv.config();

export function validateEnv() {
  const requiredEnvVars = [
    'FIREBASE_PROJECT_ID',
  ];

  const hasServiceAccountJson = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!hasServiceAccountJson) {
    requiredEnvVars.push('FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY');
  }

  const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingVars.length > 0) {
    console.error(`[CRÍTICO] Falha na inicialização. Variáveis de ambiente obrigatórias ausentes: ${missingVars.join(', ')}`);
    console.error(`Certifique-se de configurar essas variáveis no Vercel e no arquivo .env local.`);
    process.exit(1);
  }

  return {
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY,
      serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
      expectedProjectId: process.env.FIREBASE_EXPECTED_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
      apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
    },
    asaas: {
      apiKey: process.env.ASAAS_API_KEY,
      webhookToken: process.env.ASAAS_WEBHOOK_TOKEN,
      webhookSecret: process.env.ASAAS_WEBHOOK_SECRET,
      clientId: process.env.ASAAS_CLIENT_ID,
      clientSecret: process.env.ASAAS_CLIENT_SECRET,
    },
    resend: {
      apiKey: process.env.RESEND_API_KEY,
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
    },
    app: {
      env: process.env.NODE_ENV || 'development',
      platformAdminEmail: process.env.PLATFORM_ADMIN_EMAIL,
      // APP_URL pode ser sobrescrita no Vercel quando houver domínio próprio.
      // O fallback aponta para o domínio de produção atual para que o retorno
      // da Asaas nunca seja enviado para um endereço inexistente.
      url: process.env.APP_URL || 'https://lumiere-os.vercel.app',
      emailFrom: process.env.EMAIL_FROM || 'LumièreOS <onboarding@resend.dev>',
      healthcheckSecret: process.env.HEALTHCHECK_SECRET,
    }
  };
}

export const env = validateEnv();
