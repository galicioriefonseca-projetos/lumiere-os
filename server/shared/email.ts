/**
 * Serviço mínimo de e-mail transacional.
 *
 * Usa a API HTTP da Resend (https://resend.com) via fetch nativo do Node —
 * não é necessário instalar nenhum pacote novo.
 *
 * Variáveis de ambiente necessárias (ver .env.example):
 *   RESEND_API_KEY  -> chave de API gerada no painel da Resend
 *   EMAIL_FROM      -> remetente verificado, ex: "LumièreOS <contato@seudominio.com.br>"
 *   APP_URL         -> URL pública do app (já usada em outras partes do projeto)
 *
 * Se RESEND_API_KEY não estiver configurada, a função apenas loga um aviso
 * e retorna sem lançar erro — assim o webhook da Asaas nunca falha por
 * causa do envio de e-mail (o pagamento já foi processado e é o mais importante).
 */

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'LumièreOS <onboarding@resend.dev>';

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY não configurada — e-mail NÃO enviado. Destinatário:', to, 'Assunto:', subject);
    return { sent: false, reason: 'missing_api_key' };
  }

  if (!to || !to.includes('@')) {
    console.warn('[email] Destinatário inválido, e-mail não enviado:', to);
    return { sent: false, reason: 'invalid_recipient' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to: [to], subject, html })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[email] Falha ao enviar via Resend:', response.status, errText);
      return { sent: false, reason: `resend_error_${response.status}` };
    }

    return { sent: true };
  } catch (err: any) {
    console.error('[email] Erro inesperado ao enviar e-mail:', err?.message || err);
    return { sent: false, reason: 'exception' };
  }
}

/**
 * E-mail enviado assim que o pagamento é aprovado pela Asaas e a conta é
 * ativada pela primeira vez (finalAction === "created" no webhook).
 * Não bloqueia o fluxo do webhook — deve sempre ser chamado dentro de um
 * try/catch (ou já é seguro internamente, veja sendEmail acima).
 */
export async function sendActivationEmail(params: { to: string; ownerName?: string; salonName?: string; plan?: string }) {
  const appUrl = (process.env.APP_URL || 'https://app.lumiereos.com.br').replace(/\/+$/, '');
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
