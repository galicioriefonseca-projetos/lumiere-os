import { env } from "../config/env.js";
import { Resend } from "resend";

/**
 * Serviço de e-mail transacional do LumièreOS utilizando o SDK oficial da Resend.
 *
 * Variáveis de ambiente necessárias (ver .env.example):
 *   RESEND_API_KEY  -> chave de API gerada no painel da Resend
 *   EMAIL_FROM      -> remetente verificado, ex: "LumièreOS <contato@seudominio.com.br>"
 *   APP_URL         -> URL pública do app
 *
 * Inicialização preguiçosa (lazy):
 * Se RESEND_API_KEY não estiver configurada, a função apenas loga um aviso
 * e retorna sem lançar erro, evitando indisponibilidade em webhooks ou inicializações.
 */

let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  if (!resendClient) {
    const apiKey = env.resend?.apiKey || process.env.RESEND_API_KEY;
    if (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 0) {
      resendClient = new Resend(apiKey.trim());
    }
  }
  return resendClient;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<{ sent: boolean; messageId?: string; reason?: string }> {
  const from = env.app.emailFrom || process.env.EMAIL_FROM || 'LumièreOS <onboarding@resend.dev>';
  const resend = getResendClient();

  if (!resend) {
    console.warn('[email] RESEND_API_KEY não configurada — e-mail NÃO enviado. Destinatário:', to, 'Assunto:', subject);
    return { sent: false, reason: 'missing_api_key' };
  }

  if (!to || !to.includes('@')) {
    console.warn('[email] Destinatário inválido, e-mail não enviado:', to);
    return { sent: false, reason: 'invalid_recipient' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: [to.trim()],
      subject,
      html
    });

    if (error) {
      console.error('[email] Falha ao enviar via Resend SDK:', error.message);
      return { sent: false, reason: error.message };
    }

    console.log(`[email] E-mail enviado com sucesso via Resend para ${to}. ID: ${data?.id}`);
    return { sent: true, messageId: data?.id };
  } catch (err: any) {
    console.error('[email] Erro inesperado ao enviar e-mail via Resend SDK:', err?.message || err);
    return { sent: false, reason: 'exception' };
  }
}

/**
 * E-mail transacional automático enviado após a confirmação de pagamento (PAYMENT_RECEIVED ou PAYMENT_CONFIRMED),
 * contendo link exclusivo de sessão única para a rota /dashboard/configurar-empresa.
 */
export async function sendCompanySetupEmail(params: {
  to: string;
  ownerName?: string;
  setupUrl: string;
  salonName?: string;
  planName?: string;
}): Promise<{ sent: boolean; messageId?: string; reason?: string }> {
  const greetingName = params.ownerName ? params.ownerName.trim().split(' ')[0] : 'Empreendedor(a)';
  const planInfo = params.planName ? ` no plano <strong style="color: #D4AF37;">${params.planName}</strong>` : '';
  const salonInfo = params.salonName ? ` para <strong>${params.salonName}</strong>` : '';

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Configure sua empresa no LumièreOS</title>
</head>
<body style="margin: 0; padding: 0; background-color: #060608; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #060608; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #0d0d12; border: 1px solid #27272a; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
          <!-- Header Bar -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; border-bottom: 1px solid #1f1f23; text-align: left;">
              <span style="font-size: 13px; font-weight: 700; letter-spacing: 2px; color: #D4AF37; text-transform: uppercase;">LUMIÈREOS</span>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px; text-align: left;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">
                Pagamento confirmado! 🎉
              </h1>
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #d4d4d8;">
                Olá, <strong>${greetingName}</strong>!
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #a1a1aa;">
                Recebemos a confirmação do seu pagamento${planInfo}${salonInfo}. Sua assinatura já está <strong>ativa</strong>!
              </p>
              <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 1.6; color: #a1a1aa;">
                Para liberar o seu painel de gestão completo, basta concluir a configuração do seu estabelecimento clicando no botão exclusivo abaixo:
              </p>

              <!-- CTA Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${params.setupUrl}" target="_blank" rel="noopener noreferrer" style="display: block; width: 100%; box-sizing: border-box; background: #D4AF37; color: #000000; font-weight: 700; font-size: 14px; text-align: center; text-decoration: none; padding: 14px 28px; border-radius: 12px; letter-spacing: 0.2px;">
                      Configurar Minha Empresa &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <div style="background-color: #14141b; border: 1px solid #27272a; border-radius: 12px; padding: 14px 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa;">
                  🔒 <strong>Link exclusivo e seguro:</strong> Este link é de uso único e expira em 72 horas para a proteção da sua conta.
                </p>
              </div>

              <p style="margin: 0 0 8px 0; font-size: 12px; color: #71717a; line-height: 1.5;">
                Se o botão não abrir, copie e cole o endereço abaixo no seu navegador:
              </p>
              <p style="margin: 0; font-size: 12px; color: #D4AF37; word-break: break-all; line-height: 1.4;">
                <a href="${params.setupUrl}" style="color: #D4AF37; text-decoration: underline;">${params.setupUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #09090c; border-top: 1px solid #1f1f23; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #71717a;">
                LumièreOS &bull; Plataforma de gestão para o setor da beleza
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return sendEmail({
    to: params.to,
    subject: 'Pagamento confirmado! Configure sua empresa no LumièreOS',
    html
  });
}

/**
 * E-mail enviado assim que o pagamento é aprovado pela Asaas e a conta é
 * ativada pela primeira vez (finalAction === "created" no webhook).
 * Não bloqueia o fluxo do webhook — deve sempre ser chamado dentro de um
 * try/catch (ou já é seguro internamente, veja sendEmail acima).
 */
export async function sendActivationEmail(params: { to: string; ownerName?: string; salonName?: string; plan?: string }) {
  const appUrl = (env.app.url || 'https://app.lumiereos.com.br').replace(/\/+$/, '');
  const loginUrl = `${appUrl}/login?email=${encodeURIComponent(params.to)}&welcome=1`;
  const greetingName = params.ownerName ? params.ownerName.split(' ')[0] : 'tudo bem';

  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#0a0a0a; padding:32px 0;">
    <div style="max-width:480px; margin:0 auto; background:#111114; border:1px solid #26262c; border-radius:16px; padding:32px; color:#e5e5e5;">
      <p style="color:#D4AF37; letter-spacing:2px; font-size:11px; text-transform:uppercase; margin:0 0 16px;">LumièreOS</p>
      <h1 style="font-size:20px; font-weight:600; margin:0 0 16px; color:#fff;">Pagamento confirmado 🎉</h1>
      <p style="font-size:14px; line-height:1.6; color:#c7c7cc; margin:0 0 8px;">Olá, ${greetingName}!</p>
      <p style="font-size:14px; line-height:1.6; color:#c7c7cc; margin:0 0 24px;">
        Recebemos a confirmação do seu pagamento${params.plan ? ` do plano <strong>${params.plan}</strong>` : ''}
        ${params.salonName ? ` para <strong>${params.salonName}</strong>` : ''}.
        Sua conta já está ativa. Clique no botão abaixo para acessar o painel:
      </p>
      <a href="${loginUrl}" style="display:inline-block; background:#D4AF37; color:#0a0a0a; font-weight:600; font-size:13px; padding:12px 24px; border-radius:10px; text-decoration:none;">
        Acessar meu painel
      </a>
      <p style="font-size:12px; line-height:1.5; color:#7a7a80; margin:24px 0 0;">
        Se o botão não funcionar, copie e cole este link no navegador:<br/>
        <span style="word-break:break-all;">${loginUrl}</span>
      </p>
    </div>
  </div>`;

  return sendEmail({
    to: params.to,
    subject: 'Pagamento confirmado — sua conta LumièreOS está ativa',
    html
  });
}

/**
 * E-mail enviado quando o checkout é gerado, para que o cliente tenha
 * o link salvo no e-mail caso feche a aba sem querer.
 */
export async function sendCheckoutEmail(params: { to: string; ownerName?: string; checkoutUrl: string; plan?: string }) {
  const greetingName = params.ownerName ? params.ownerName.split(' ')[0] : 'tudo bem';

  const html = `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#0a0a0a; padding:32px 0;">
    <div style="max-width:480px; margin:0 auto; background:#111114; border:1px solid #26262c; border-radius:16px; padding:32px; color:#e5e5e5;">
      <p style="color:#D4AF37; letter-spacing:2px; font-size:11px; text-transform:uppercase; margin:0 0 16px;">LumièreOS</p>
      <h1 style="font-size:20px; font-weight:600; margin:0 0 16px; color:#fff;">Complete sua assinatura</h1>
      <p style="font-size:14px; line-height:1.6; color:#c7c7cc; margin:0 0 8px;">Olá, ${greetingName}!</p>
      <p style="font-size:14px; line-height:1.6; color:#c7c7cc; margin:0 0 24px;">
        Falta pouco para você liberar o acesso ao seu painel LumièreOS${params.plan ? ` no plano <strong>${params.plan}</strong>` : ''}.
        Se você já pagou, ignore este e-mail. Caso ainda não tenha finalizado, clique no botão abaixo para concluir o pagamento com segurança:
      </p>
      <a href="${params.checkoutUrl}" style="display:inline-block; background:#D4AF37; color:#0a0a0a; font-weight:600; font-size:13px; padding:12px 24px; border-radius:10px; text-decoration:none;">
        Concluir pagamento
      </a>
      <p style="font-size:12px; line-height:1.5; color:#7a7a80; margin:24px 0 0;">
        Se o botão não funcionar, copie e cole este link no navegador:<br/>
        <span style="word-break:break-all;">${params.checkoutUrl}</span>
      </p>
    </div>
  </div>`;

  return sendEmail({
    to: params.to,
    subject: 'Finalize sua assinatura do LumièreOS',
    html
  });
}

