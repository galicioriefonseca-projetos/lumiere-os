import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../_shared/firebaseAdmin.js";
import { verifyIdToken, resolvePlatformAdmin } from "../_shared/auth.js";
import { processCaktoWebhookPayload } from "./webhook.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // 1. Autenticar usuário Firebase
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (authErr: any) {
      console.error("[Cakto Webhook Test Serverless] Erro de autenticação:", authErr);
      return res.status(401).json({ error: authErr.message || "Sessão inválida ou expirada." });
    }

    // 2. Validar Platform Admin
    const adminDb = getAdminDb();
    const platformAdmin = await resolvePlatformAdmin(user, adminDb);
    if (!platformAdmin) {
      return res.status(403).json({
        error: "Acesso restrito a administradores da plataforma."
      });
    }

    // 3. Receber parâmetros
    const { salonId, offerId, subscriptionId, orderId, event } = req.body || {};

    if (!salonId) {
      return res.status(400).json({ error: "O parâmetro salonId é obrigatório." });
    }

    const allowedEvents = [
      "purchase_approved",
      "subscription_created",
      "subscription_renewed",
      "subscription_canceled",
      "purchase_refused",
      "subscription_renewal_refused",
      "refund",
      "chargeback"
    ];

    if (!event || !allowedEvents.includes(event)) {
      return res.status(400).json({ error: `O evento informado é inválido ou não suportado. Eventos válidos: ${allowedEvents.join(", ")}` });
    }

    const salonSnap = await adminDb.collection("salons").doc(String(salonId)).get();

    if (!salonSnap.exists) {
      return res.status(404).json({ error: `Salão com ID ${salonId} não encontrado no Firestore.` });
    }

    const salonData = salonSnap.data();
    const customerEmail = salonData?.ownerEmail || salonData?.caktoCheckoutEmail || "homologation_test@lumiereos.com";

    // 4. Simular exatamente o payload enviado pela Cakto
    const simulatedPayload = {
      event: event,
      order_id: orderId || `ord_homolog_${Date.now()}`,
      subscription_id: subscriptionId || `sub_homolog_${Date.now()}`,
      offer_id: offerId || salonData?.caktoOfferId || "off_homolog_default",
      external_id: String(salonId),
      customer: {
        email: customerEmail,
        name: salonData?.ownerName || "Cliente Homologação"
      },
      amount: 149.90,
      event_id: `ev_${event}_test_${Date.now()}`
    };

    console.log(`[Cakto Webhook Test Serverless] Iniciando simulação de evento '${event}' para o salão ${salonId}...`);

    // 5. Chamar a MESMA função utilizada pelo webhook oficial, pulando a validação de token/duplicados (skipTokenValidation = true, isSimulation = true)
    const result = await processCaktoWebhookPayload(simulatedPayload, true, true);

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[Cakto Webhook Test Serverless Error] Falha de processamento:", err);
    return res.status(500).json({ error: err.message || "Erro interno no processamento do teste de webhook." });
  }
}
