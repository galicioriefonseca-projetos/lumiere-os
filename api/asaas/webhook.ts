import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../_shared/firebaseAdmin";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const receivedToken = req.headers["asaas-access-token"];
    const expectedToken = process.env.ASAAS_WEBHOOK_SECRET;

    if (!expectedToken || receivedToken !== expectedToken) {
      console.warn("[Asaas Webhook Serverless] Assinatura/token de webhook inválido.");
      return res.status(401).json({ error: "Chave secreta de webhook inválida." });
    }

    const { event, payment, subscription } = req.body || {};
    console.log(`[Asaas Webhook Serverless] Evento recebido: ${event}`);

    let customerId = payment?.customer || subscription?.customer;
    let subscriptionId = payment?.subscription || subscription?.id;

    if (!customerId) {
      console.warn("[Asaas Webhook Serverless] Sem ID do cliente no payload recebido.");
      return res.status(200).json({ received: true, info: "Sem ID do cliente, ignorando." });
    }

    const adminDb = getAdminDb();
    
    // Localizar o salão no Firestore pelo asaasCustomerId
    let salonSnapshot = await adminDb.collection("salons")
      .where("asaasCustomerId", "==", customerId)
      .limit(1)
      .get();

    // Fallback: Localizar pelo asaasSubscriptionId se a busca anterior falhar
    if (salonSnapshot.empty && subscriptionId) {
      salonSnapshot = await adminDb.collection("salons")
        .where("asaasSubscriptionId", "==", subscriptionId)
        .limit(1)
        .get();
    }

    if (salonSnapshot.empty) {
      console.warn(`[Asaas Webhook Serverless] Salão não localizado para customerId ${customerId} ou subscriptionId ${subscriptionId}`);
      return res.status(200).json({ received: true, info: "Salão correspondente não localizado." });
    }

    const salonDoc = salonSnapshot.docs[0];
    const salonRef = salonDoc.ref;
    const salonData = salonDoc.data();

    // Proteção contra webhook duplicado (idempotência avançada):
    if (
      salonData?.asaasLastEvent === event &&
      payment?.id &&
      salonData?.asaasLastPaymentId === payment.id
    ) {
      console.log(`[Asaas Webhook Serverless] Evento duplicado já processado anteriormente para o pagamento ${payment.id}. Ignorando.`);
      return res.status(200).json({ success: true, info: "Evento duplicado já processado." });
    }

    const updatePayload: any = {
      updatedAt: Date.now(),
      asaasLastEvent: event,
    };

    if (payment?.id) {
      updatePayload.asaasLastPaymentId = payment.id;
    }

    switch (event) {
      case "PAYMENT_CREATED":
        updatePayload.paymentStatus = "pending";
        break;

      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED":
        updatePayload.paymentStatus = "paid";
        updatePayload.subscriptionStatus = "active";
        updatePayload.lastPaymentAt = Date.now();
        updatePayload.lastPaymentAmount = payment.value;
        updatePayload.lastPaymentMethod = payment.billingType;
        if (payment.dueDate) {
          updatePayload.nextBillingDate = new Date(payment.dueDate).getTime();
        }
        break;

      case "PAYMENT_OVERDUE":
        updatePayload.paymentStatus = "overdue";
        updatePayload.subscriptionStatus = "overdue";
        break;

      case "PAYMENT_DELETED":
        updatePayload.paymentStatus = "canceled";
        break;

      case "SUBSCRIPTION_CREATED":
        updatePayload.asaasSubscriptionId = subscription.id;
        updatePayload.subscriptionStatus = subscription.status === "ACTIVE" ? "active" : "trial";
        if (subscription.nextDueDate) {
          updatePayload.nextBillingDate = new Date(subscription.nextDueDate).getTime();
        }
        break;

      case "SUBSCRIPTION_UPDATED":
        if (subscription.status === "ACTIVE") {
          updatePayload.subscriptionStatus = "active";
        } else if (subscription.status === "OVERDUE") {
          updatePayload.subscriptionStatus = "overdue";
        } else if (subscription.status === "INACTIVE" || subscription.status === "CANCELED" || subscription.status === "EXPIRED") {
          updatePayload.subscriptionStatus = "canceled";
        }
        if (subscription.nextDueDate) {
          updatePayload.nextBillingDate = new Date(subscription.nextDueDate).getTime();
        }
        break;

      case "SUBSCRIPTION_DELETED":
        updatePayload.subscriptionStatus = "canceled";
        break;

      default:
        console.log(`[Asaas Webhook Serverless] Evento recebido não necessita de tratamento direto: ${event}`);
        break;
    }

    // Persistir mutações de faturamento diretamente no Firestore usando privilégios admin
    await salonRef.update(updatePayload);
    console.log(`[Asaas Webhook Serverless] Sincronização concluída com sucesso para o salão ${salonDoc.id} (Evento: ${event})`);

    return res.status(200).json({ success: true, eventProcessed: event });
  } catch (err: any) {
    console.error("[Asaas Webhook Serverless] Falha ao processar evento de webhook do Asaas:", err);
    return res.status(500).json({ error: err.message || "Erro interno no servidor de webhook." });
  }
}
