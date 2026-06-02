import { Readable } from 'stream';
import Stripe from 'stripe';
import { getFirebaseAdmin, getAdminDb, getStripe } from './_utils';

// Desabilita body parser automático do Vercel para ler o raw body do Stripe
export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(readable: Readable): Promise<Buffer> {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido. Utilize o método POST." });
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.warn("[Lumiere Webhook] Assinatura ausente ou secret de webhook Stripe não configurada.");
    return res.status(400).send("Assinatura obrigatória ou segredo de assinatura ausente.");
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error(`[Lumiere Webhook Security] Erro na validação de assinatura: ${err.message}`);
    return res.status(400).send(`Erro de validação: ${err.message}`);
  }

  console.log(`[Lumiere Webhook] Evento Stripe válido recebido: ${event.type}`);

  try {
    const adminDb = getAdminDb();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const salonId = session.metadata?.salonId;
        const plan = session.metadata?.plan;
        const stripeCustomerId = session.customer as string;
        const stripeSubscriptionId = session.subscription as string;

        if (salonId) {
          const updateFields: any = {
            stripeCustomerId: stripeCustomerId || "",
            stripeSubscriptionId: stripeSubscriptionId || "",
            billingProvider: "stripe",
            billingMode: "recurring_card",
            subscriptionStatus: "active",
            paymentStatus: "paid",
            updatedAt: Date.now(),
          };

          // Gravar o plano de faturamento no Firestore, caso enviado via Stripe Metadata
          if (plan) {
            updateFields.plan = plan;
          }

          await adminDb.collection("salons").doc(salonId).update(updateFields);
          console.log(`[Lumiere Webhook Sync] Setup de faturamento completo no salão '${salonId}' para plano '${plan}'`);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const stripeSubscriptionId = subscription.id;
        const stripeCustomerId = subscription.customer as string;
        const salonId = subscription.metadata?.salonId;

        let salonRef: any = null;
        if (salonId) {
          salonRef = adminDb.collection("salons").doc(salonId);
        } else {
          const querySnap = await adminDb.collection("salons").where("stripeSubscriptionId", "==", stripeSubscriptionId).limit(1).get();
          if (!querySnap.empty) {
            salonRef = querySnap.docs[0].ref;
          } else {
            const customerSnap = await adminDb.collection("salons").where("stripeCustomerId", "==", stripeCustomerId).limit(1).get();
            if (!customerSnap.empty) {
              salonRef = customerSnap.docs[0].ref;
            }
          }
        }

        if (salonRef) {
          const statusMap: Record<string, string> = {
            active: "active",
            past_due: "overdue",
            unpaid: "overdue",
            canceled: "canceled",
            incomplete: "pending_payment",
            incomplete_expired: "canceled",
            trialing: "active",
          };
          const mappedStatus = statusMap[subscription.status] || "pending_payment";

          await salonRef.update({
            stripeSubscriptionId,
            stripeCustomerId,
            subscriptionStatus: mappedStatus,
            currentPeriodStart: subscription.current_period_start * 1000,
            currentPeriodEnd: subscription.current_period_end * 1000,
            nextBillingDate: subscription.current_period_end * 1000,
            updatedAt: Date.now(),
          });
          console.log(`[Lumiere Webhook Sync] Sincronização de assinatura ocorrida.`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const stripeSubscriptionId = subscription.id;

        const querySnap = await adminDb.collection("salons").where("stripeSubscriptionId", "==", stripeSubscriptionId).get();
        for (const doc of querySnap.docs) {
          await doc.ref.update({
            subscriptionStatus: "canceled",
            paymentStatus: "canceled",
            activationStatus: "canceled",
            isActive: false,
            updatedAt: Date.now(),
          });
          console.log(`[Lumiere Webhook Sync] Assinatura cancelada via portal para salão ID: ${doc.id}`);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as any;
        const stripeSubscriptionId = invoice.subscription as string;
        const stripeCustomerId = invoice.customer as string;

        if (stripeSubscriptionId) {
          const querySnap = await adminDb.collection("salons").where("stripeSubscriptionId", "==", stripeSubscriptionId).get();
          for (const doc of querySnap.docs) {
            const salonId = doc.id;
            const salonData = doc.data() as any;
            const amountPaidBRL = (invoice.amount_paid || 0) / 100;

            await doc.ref.update({
              subscriptionStatus: "active",
              paymentStatus: "paid",
              lastPaymentAt: Date.now(),
              lastPaymentAmount: amountPaidBRL,
              lastPaymentMethod: "credit_card",
              isActive: true,
              activationStatus: "active",
              updatedAt: Date.now(),
            });

            const paymentId = `stripe_${invoice.id || Date.now()}`;
            await doc.ref.collection("payments").doc(paymentId).set({
              id: paymentId,
              salonId,
              plan: salonData.plan || "studio",
              amount: amountPaidBRL,
              method: "credit_card",
              status: "paid",
              reportedByUserId: "stripe_webhook",
              reportedByEmail: "stripe_webhook@lumiere.com",
              reportedAt: Date.now(),
              confirmedByUserId: "stripe_webhook",
              confirmedByEmail: "stripe_webhook@lumiere.com",
              confirmedAt: Date.now(),
              notes: `Fatura Stripe liquidada com sucesso (Invoice: ${invoice.id})`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              provider: "stripe",
              stripePaymentIntentId: (invoice.payment_intent as string) || "",
              stripeInvoiceId: invoice.id || "",
              stripeSubscriptionId: stripeSubscriptionId || "",
              stripeCustomerId: stripeCustomerId || "",
              currency: invoice.currency || "brl",
            });
            console.log(`[Lumiere Webhook Sync] Fatura paga & registrada para salão: ${salonId}`);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const stripeSubscriptionId = invoice.subscription as string;

        if (stripeSubscriptionId) {
          const querySnap = await adminDb.collection("salons").where("stripeSubscriptionId", "==", stripeSubscriptionId).get();
          for (const doc of querySnap.docs) {
            await doc.ref.update({
              paymentStatus: "overdue",
              subscriptionStatus: "overdue",
              updatedAt: Date.now(),
            });
            console.warn(`[Lumiere Webhook Sync] Alerta de fatura recusada no Stripe para estabelecimento: ${doc.id}`);
          }
        }
        break;
      }

      default:
        console.log(`[Lumiere Webhook] Ignorando evento Stripe irrelevante: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error(`[Lumiere Webhook Execute Error] Erro ao gravar alterações: ${err.message}`);
    return res.status(500).send(`Erro interno de persistência: ${err.message}`);
  }
}
