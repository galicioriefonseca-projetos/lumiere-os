import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../_shared/firebaseAdmin.js";
import { verifyIdToken, canManageBilling } from "../_shared/auth.js";

interface CaktoSettings {
  productId: string;
  startOfferId: string;
  founderOfferId: string;
  performanceOfferId: string;
  networkOfferId: string;
  enterpriseOfferId: string;
  updatedAt?: number;
}

const PLANS_PRICES: Record<string, number> = {
  start: 197,
  founder: 297,
  performance: 397,
  network: 797,
  enterprise: 1997
};

const PLANS_MAX_PROFESSIONALS: Record<string, number> = {
  start: 5,
  founder: 22,
  performance: 20,
  network: 999,
  enterprise: 9999
};

const PLAN_NAMES: Record<string, string> = {
  start: "Start",
  founder: "Founder (Pioneiro)",
  performance: "Performance",
  network: "Network",
  enterprise: "Enterprise"
};

async function getCaktoSettingsCached(adminDb: any): Promise<CaktoSettings> {
  const docRef = adminDb.collection("settings").doc("cakto");
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    const data = docSnap.data();
    return {
      productId: data?.productId || "",
      startOfferId: data?.startOfferId || "",
      founderOfferId: data?.founderOfferId || "",
      performanceOfferId: data?.performanceOfferId || "",
      networkOfferId: data?.networkOfferId || "",
      enterpriseOfferId: data?.enterpriseOfferId || "",
      updatedAt: data?.updatedAt
    };
  }
  return {
    productId: "",
    startOfferId: "",
    founderOfferId: "",
    performanceOfferId: "",
    networkOfferId: "",
    enterpriseOfferId: ""
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { salonId, planId, action } = req.body || {};

    if (!salonId) {
      return res.status(400).json({ error: "O campo salonId é obrigatório." });
    }

    // 1. Autenticação do Usuário
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (authErr: any) {
      console.error("[Cakto ChangePlan Serverless] Erro de autenticação:", authErr);
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }

    const adminDb = getAdminDb();
    const salonRef = adminDb.collection("salons").doc(salonId);
    const salonDoc = await salonRef.get();

    if (!salonDoc.exists) {
      return res.status(404).json({ error: "Salão não encontrado." });
    }

    const salonData = salonDoc.data();

    // 2. Autorização de Faturamento
    const authResult = await canManageBilling(user, salonId, salonData);
    if (!authResult.authorized) {
      return res.status(403).json({ error: authResult.reason || "Não autorizado a gerenciar o faturamento deste salão." });
    }

    // Ação 1: Cancelar mudança programada
    if (action === "cancel") {
      const pending = salonData?.pendingPlanChange;
      if (!pending || pending.status !== "scheduled") {
        return res.status(400).json({ error: "Não há nenhuma mudança programada ativa para ser cancelada." });
      }

      await salonRef.update({
        "pendingPlanChange.status": "canceled",
        // Keep history record but disable active scheduling
        pendingPlanChange: null
      });

      // Registrar histórico
      const historyRef = salonRef.collection("billingHistory").doc();
      await historyRef.set({
        id: historyRef.id,
        eventType: "change_canceled",
        title: "Mudança de Plano Cancelada",
        description: `A alteração programada do plano para ${PLAN_NAMES[pending.toPlan] || pending.toPlan} foi cancelada pelo usuário.`,
        plan: pending.toPlan,
        timestamp: Date.now(),
        recordedBy: user.email || "Usuário"
      });

      return res.status(200).json({ success: true, message: "Mudança programada cancelada com sucesso." });
    }


    // Ação 3: Programar/Agendar mudança de plano
    if (action === "schedule") {
      if (!planId) {
        return res.status(400).json({ error: "O plano de destino (planId) é obrigatório." });
      }

      const validPlans = ["start", "performance", "network", "enterprise", "founder"];
      if (!validPlans.includes(planId)) {
        return res.status(400).json({ error: "O plano de destino especificado é inválido." });
      }

      // Se for Founder, validar autorização explícita
      if (planId === "founder") {
        const isAuthorizedFounder = salonData?.founderAuthorized === true || 
                                    salonData?.isFounderAuthorized === true || 
                                    salonData?.plan === "founder";
        if (!isAuthorizedFounder) {
          return res.status(403).json({ error: "Você não possui autorização explícita para o plano Founder." });
        }
      }

      const currentPlan = salonData?.plan || "start";
      if (currentPlan === planId) {
        return res.status(400).json({ error: "O plano de destino é igual ao plano atual." });
      }

      // Validar compatibilidade de profissionais cadastrados
      const maxAllowedProfs = PLANS_MAX_PROFESSIONALS[planId] || 0;
      const professionalsSnap = await salonRef.collection("professionals").get();
      const registeredProfsCount = professionalsSnap.size;

      if (registeredProfsCount > maxAllowedProfs) {
        return res.status(400).json({ 
          error: `Incompatibilidade: O plano ${PLAN_NAMES[planId]} suporta no máximo ${maxAllowedProfs} profissionais. Atualmente você possui ${registeredProfsCount} colaboradores cadastrados. Remova profissionais excedentes antes de prosseguir com o downgrade.` 
        });
      }

      // Validar compatibilidade de multi-unidades
      const unitsCount = salonData?.unitsCount || (salonData?.units ? (Array.isArray(salonData.units) ? salonData.units.length : 1) : 1);
      const isMultiUnitPlan = planId === "network" || planId === "enterprise";
      if (unitsCount > 1 && !isMultiUnitPlan) {
        return res.status(400).json({
          error: `Incompatibilidade: Você possui ${unitsCount} unidades configuradas. O plano ${PLAN_NAMES[planId]} não oferece suporte para Gestão Multiunidade. Remova as unidades excedentes antes de solicitar o downgrade.`
        });
      }

      // Obter oferta correspondente da Cakto
      const sData = await getCaktoSettingsCached(adminDb);
      let targetOfferId = "";
      switch (planId) {
        case "start": targetOfferId = sData.startOfferId || ""; break;
        case "founder": targetOfferId = sData.founderOfferId || ""; break;
        case "performance": targetOfferId = sData.performanceOfferId || ""; break;
        case "network": targetOfferId = sData.networkOfferId || ""; break;
        case "enterprise": targetOfferId = sData.enterpriseOfferId || ""; break;
      }

      // Se não houver configurações, usar uma simulada ou retornar erro
      if (!targetOfferId && process.env.NODE_ENV === "production") {
        return res.status(400).json({ error: "Oferta de pagamento não configurada na Cakto para o plano selecionado." });
      }

      const currentAmount = PLANS_PRICES[currentPlan] || 0;
      const targetAmount = PLANS_PRICES[planId] || 0;
      const priceDifference = targetAmount - currentAmount;

      const effectiveAt = salonData?.nextBillingDate || (Date.now() + 30 * 24 * 60 * 60 * 1000);

      const pendingPlanChange = {
        fromPlan: currentPlan,
        toPlan: planId,
        currentAmount,
        targetAmount,
        priceDifference,
        targetOfferId: targetOfferId || `off_simulated_${planId}`,
        requestedAt: Date.now(),
        effectiveAt,
        status: "awaiting_gateway"
      };

      await salonRef.update({
        pendingPlanChange,
        updatedAt: Date.now()
      });

      // Registrar histórico de solicitação de mudança
      const historyRef = salonRef.collection("billingHistory").doc();
      await historyRef.set({
        id: historyRef.id,
        eventType: "change_requested",
        title: "Mudança de Plano Solicitada",
        description: `Solicitada alteração de plano de ${PLAN_NAMES[currentPlan]} para ${PLAN_NAMES[planId]}. Aguardando processamento do gateway.`,
        plan: planId,
        timestamp: Date.now(),
        recordedBy: user.email || "Usuário"
      });

      return res.status(200).json({ 
        success: true, 
        message: "Solicitação registrada. A mudança será confirmada após processamento do gateway.",
        pendingPlanChange
      });
    }

    return res.status(400).json({ error: "Ação inválida." });

  } catch (err: any) {
    console.error("[Cakto ChangePlan Serverless API Error] Falha:", err);
    return res.status(500).json({ error: err.message || "Erro interno do servidor ao processar mudança de plano." });
  }
}
