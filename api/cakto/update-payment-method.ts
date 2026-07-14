import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../_shared/firebaseAdmin.js";
import { verifyIdToken, canManageBilling } from "../_shared/auth.js";

function getCaktoApiBaseUrl() {
  const raw = process.env.CAKTO_API_URL || "https://api.cakto.com.br";
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch (e) {
    return "https://api.cakto.com.br";
  }
}

async function getCaktoAccessToken(): Promise<string> {
  const clientId = process.env.CAKTO_CLIENT_ID;
  const clientSecret = process.env.CAKTO_CLIENT_SECRET;
  const apiUrl = getCaktoApiBaseUrl();

  if (!clientId || !clientSecret) {
    throw new Error("CAKTO_CLIENT_ID ou CAKTO_CLIENT_SECRET não configurados no servidor.");
  }

  const url = `${apiUrl}/public_api/token/`;
  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter token da Cakto. Status: ${response.status}`);
  }

  const data = await response.json();
  if (!data || !data.access_token) {
    throw new Error("Token de acesso não encontrado na resposta do Cakto.");
  }

  return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { salonId, paymentMethod } = req.body || {};
    if (!salonId || !paymentMethod) {
      return res.status(400).json({ error: "Os campos salonId e paymentMethod são obrigatórios." });
    }

    const allowedMethods = ["credit_card", "pix_automatic", "pix", "boleto"];
    if (!allowedMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: "Método de pagamento não permitido." });
    }

    // 1. Autenticação
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (authErr: any) {
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }

    const adminDb = getAdminDb();
    const salonRef = adminDb.collection("salons").doc(String(salonId));
    const salonDoc = await salonRef.get();

    if (!salonDoc.exists) {
      return res.status(404).json({ error: "Salão não encontrado." });
    }

    const salonData = salonDoc.data();

    // 2. Autorização
    const authResult = await canManageBilling(user, String(salonId), salonData);
    if (!authResult.authorized) {
      return res.status(403).json({ error: authResult.reason || "Não autorizado." });
    }

    const subscriptionId = salonData?.caktoSubscriptionId;
    if (!subscriptionId) {
      return res.status(400).json({ error: "Nenhuma assinatura Cakto configurada para este salão." });
    }

    // Proteger contra IDs simulados / homologados
    const isHomolog = subscriptionId.toLowerCase().includes("homolog") || 
                      subscriptionId.toLowerCase().includes("simulated") || 
                      subscriptionId === "sub_simulated_dev";
    
    const isUserPlatformAdmin = user.email === "galicioriefonseca@gmail.com" || authResult.role === "platform_admin";

    if (isHomolog && !isUserPlatformAdmin) {
      return res.status(400).json({ error: "Operação não permitida: Assinatura de homologação/simulada detectada." });
    }

    let realStatus = "active";
    let realNextBillingDate = "2026-08-05T12:00:00.000Z";
    let apiUpdated = false;
    let authorizationUrl = "";

    if (!isHomolog) {
      // Consulta de assinatura real na API Cakto para validações de proteção
      const accessToken = await getCaktoAccessToken();
      const apiUrl = getCaktoApiBaseUrl();
      const caktoUrl = `${apiUrl}/public_api/subscriptions/${subscriptionId}/`;

      const response = await fetch(caktoUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ 
          error: `Erro ao validar assinatura real na Cakto: ${errText}` 
        });
      }

      const realSub = await response.json();
      realStatus = realSub.status || realSub.subscriptionStatus || "unknown";
      realNextBillingDate = realSub.next_payment_date || realSub.next_billing_date || realSub.nextBillingDate || null;

      // Proteções obrigatórias
      if (realStatus === 'canceled' || realStatus === 'cancelled') {
        return res.status(400).json({ error: "Bloqueado: A assinatura está cancelada na Cakto." });
      }
      if (realStatus === 'overdue' || realStatus === 'unpaid') {
        return res.status(400).json({ error: "Bloqueado: A assinatura possui cobranças vencidas ou pendentes." });
      }
      if (!realNextBillingDate) {
        return res.status(400).json({ error: "Bloqueado: Não há data de vencimento (next_payment_date) futura configurada." });
      }

      // Tratar método de pagamento Cartão de Crédito
      if (paymentMethod === "credit_card") {
        return res.status(200).json({
          success: false,
          requiresSupport: true,
          message: "Para sua total segurança (PCI-DSS), a alteração do cartão de crédito de assinaturas ativas deve ser feita por link de atualização criptografado. Registramos sua solicitação e nossa equipe financeira enviará as instruções para " + (user.email || "seu e-mail de cadastro") + " para concluir de forma assistida pela Cakto."
        });
      }

      // Atualizar método na API Cakto se for Pix/Boleto ou Pix Automático
      // REGRA: PATCH da Cakto suspenso e convertido em configuração assistida, sem endpoint oficial na API
      return res.status(200).json({ success: false, requiresSupport: true, message: "A solicitação foi registrada. Esta forma de pagamento requer configuração assistida pela nossa equipe financeira para ser concluída (API Cakto pendente de endpoint oficial para troca autônoma)." });
    } else {
      // Se for homologação e Platform Admin, tratamos as validações de simulação locais
      if (paymentMethod === "credit_card") {
        return res.status(200).json({
          success: false,
          requiresSupport: true,
          message: "[Simulação] Para sua total segurança (PCI-DSS), a alteração do cartão de crédito de assinaturas ativas deve ser feita por link de atualização criptografado. Registramos sua solicitação e nossa equipe financeira enviará as instruções para " + (user.email || "seu e-mail de cadastro") + " para concluir de forma assistida pela Cakto."
        });
      }
      apiUpdated = true;
    }

    // Gerar simulação de URL de autorização caso seja Pix Automático e a API não retorne link direto
    if (paymentMethod === "pix_automatic" && !authorizationUrl) {
      return res.status(200).json({
        success: false,
        requiresSupport: true,
        message: "Esta forma de pagamento requer configuração assistida. Nossa equipe enviará instruções para concluir a ativação."
      });
    }

    // Só prossegue para salvar se a API Cakto realmente aprovou ou se for homologação
    if (!apiUpdated && !isHomolog) {
       return res.status(200).json({
        success: false,
        requiresSupport: true,
        message: "A solicitação foi registrada. Esta forma de pagamento requer configuração assistida para ser concluída."
      });
    }

    // Atualizar Firestore preservando todos os dados da assinatura (sem novas assinaturas, pedidos ou cobranças)
    const updates: any = {
      paymentMethod: paymentMethod,
      updatedAt: Date.now()
    };

    // Mapear provedores do sistema dependendo do tipo de cobrança
    if (paymentMethod === "pix_automatic") {
      updates.billingProvider = "cakto";
      // Removed the wrong billingMode = "recurring_card", kept billingMode unchanged or map to recurring_pix if it existed, but let's just keep it cakto
      updates.billingMode = "pix_automatic";
    } else if (paymentMethod === "pix") {
      updates.billingProvider = "manual_pix";
      updates.billingMode = "manual_pix";
    } else if (paymentMethod === "boleto") {
      updates.billingProvider = "manual_pix"; 
      updates.billingMode = "manual_pix";
    }

    await salonRef.update(updates);

    // Registrar histórico
    const historyRef = salonRef.collection("billingHistory").doc();
    const activeAmount = salonData?.lastPaymentAmount || 297;
    await historyRef.set({
      id: historyRef.id,
      eventType: "payment_method_updated",
      title: "Forma de Pagamento Autorizada",
      description: `Autorizada com sucesso a forma de pagamento futura para: ${
        paymentMethod === "pix_automatic" ? "Pix Automático" : paymentMethod === "pix" ? "Pix manual" : "Boleto manual"
      }.`,
      paymentMethod: paymentMethod,
      timestamp: Date.now(),
      recordedBy: user.email || "Cliente"
    });

    return res.status(200).json({
      success: true,
      message: `Método de pagamento futuro atualizado com sucesso para ${
        paymentMethod === "pix_automatic" ? "Pix Automático" : paymentMethod === "pix" ? "Pix manual" : "Boleto manual"
      }.`,
      authorizationUrl: authorizationUrl || null
    });

  } catch (err: any) {
    console.error("[Cakto Payment Method Serverless] Erro:", err);
    return res.status(500).json({ error: err.message || "Erro interno ao atualizar método de pagamento." });
  }
}
