import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// Carregar variáveis de ambiente
dotenv.config();

// Inicialização Preguiçosa do Firebase Admin SDK para prevenir travamentos se ausente
let adminApp: any = null;
const getFirebaseAdmin = () => {
  if (!adminApp) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.warn("[Lumiere System] Aviso: Configurações do Firebase Admin SDK ausentes ou incompletas no .env do servidor.");
      throw new Error("O Firebase Admin SDK não foi devidamente configurado nas variáveis de ambiente.");
    }

    try {
      const firebaseAdmin = (admin as any).default || admin;
      const apps = firebaseAdmin.apps || [];
      if (apps.length > 0) {
        adminApp = apps[0];
      } else {
        adminApp = firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, "\n"),
          }),
        });
      }
    } catch (err: any) {
      console.error("Erro ao inicializar Firebase Admin:", err);
      throw err;
    }
  }
  return adminApp;
};

const getAdminDb = () => {
  const appInstance = getFirebaseAdmin();
  const firebaseAdmin = (admin as any).default || admin;
  return firebaseAdmin.firestore(appInstance);
};

// Inicialização Preguiçosa do Stripe para prevenir travamentos se ausente
let stripeInstance: Stripe | null = null;
const getStripe = (): Stripe => {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY não foi configurada no ambiente do servidor.");
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2023-10-16" as any,
    });
  }
  return stripeInstance;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware básicos (evitando express.json() no webhook para preservar o raw body do Stripe)
  app.use((req, res, next) => {
    if (req.originalUrl === "/api/stripe/webhook") {
      next();
    } else {
      express.json()(req, res, next);
    }
  });

  // Habilitar CORS de forma nativa e segura
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });

  // Rota de Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "online", timestamp: Date.now(), service: "Lumiere Backend API" });
  });

  // Rota de Health Check do Stripe para diagnóstico seguro no preview/deploy
  app.get("/api/stripe/health", (req, res) => {
    const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
    const firebaseAdminConfigured = !!(
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    );
    const hasFounderPrice = !!process.env.STRIPE_PRICE_FOUNDER;
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    res.json({
      ok: stripeConfigured && firebaseAdminConfigured,
      stripeConfigured,
      firebaseAdminConfigured,
      hasFounderPrice,
      appUrl
    });
  });

  // API Route para o Gemini Insights (Mantendo funcionalidades existentes do LumièreOS)
  app.post("/api/gemini-insight", async (req, res) => {
    try {
      const {
        salonName,
        businessTypeTranslated,
        monthlyCount,
        checklistPct,
        goalPercentage,
        goalCurrent,
        goalTarget,
        professionalsCount,
      } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "A chave de API do Gemini (GEMINI_API_KEY) não foi configurada nas variáveis de ambiente do servidor."
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `Você é um consultor especialista sênior em gestão de negócios para salões e clínicas de beleza parceiros do LumièreOS. 
Analise os seguintes indicadores de desempenho do estabelecimento "${salonName || 'Nosso Salão'}" (${businessTypeTranslated || 'Salão de Beleza'}) e gere um insight executivo personalizado de alto nível com um olhar cirúrgico:

Agendamentos este mês: ${monthlyCount || 0}
Uso/Aderência do Checklist Operacional Diário Essenza: ${checklistPct || 0}% de conformidade hoje.
Meta de faturamento do mês: ${goalPercentage || 0}% atingida (Atual: R$ ${(goalCurrent || 0).toLocaleString('pt-BR')} de uma meta planejada de R$ ${(goalTarget || 0).toLocaleString('pt-BR')}).
Membros ativos na equipe: ${professionalsCount || 0} profissionais cadastrados.

Gere um diagnóstico analítico em exatamente 2 ou 3 frases. Seja direto, motivador e encorajador, porém prático e profissional.
Foque em destacar um ponto positivo e propor uma sugestão estratégica cirúrgica de melhoria imediata usando linguagens do mercado ou práticas premium de atendimento.
Use sempre o tom em português (do Brasil). Não use saudações introdutórias como "Olá" ou "Com base nos dados", vá direto para a análise executiva.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });

      if (response && response.text) {
        return res.json({ text: response.text.trim() });
      } else {
        throw new Error('Retorno vazio da inteligência artificial.');
      }
    } catch (err: any) {
      console.error('Erro ao gerar insights do Gemini no servidor:', err);
      return res.status(500).json({
        error: err?.message || 'Falha de comunicação com o servidor Lumière AI. Tente novamente em instantes.'
      });
    }
  });

  // Endpoints do Stripe

  // 1. Criar Checkout Session para assinatura
  app.post("/api/stripe/create-checkout-session", async (req, res) => {
    try {
      const { salonId, plan, userId } = req.body;
      if (!salonId || !plan) {
        return res.status(400).json({ error: "Parâmetros 'salonId' e 'plan' são obrigatórios." });
      }

      // Validar variáveis de ambiente fundamentais antes de iniciar
      if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: "Stripe não configurado: STRIPE_SECRET_KEY ausente no servidor." });
      }
      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
        return res.status(500).json({ error: "Firebase não configurado: credenciais do Firebase Admin SDK ausentes no servidor." });
      }

      // Validar autenticação do usuário se houver token BEARER ou fallback de userId
      const authHeader = req.headers.authorization;
      let decodedToken: any = null;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const idToken = authHeader.split("Bearer ")[1];
        try {
          const adminAppInstance = getFirebaseAdmin();
          decodedToken = await adminAppInstance.auth().verifyIdToken(idToken);
        } catch (err) {
          console.warn("[Stripe Dev] Token de autenticação Bearer expirado ou inválido, usando ID alternativo.");
        }
      }

      const verifiedUserId = decodedToken?.uid || userId;
      if (!verifiedUserId) {
        return res.status(401).json({ error: "Requer autenticação do usuário. Por favor, faça login novamente." });
      }

      const adminDb = getAdminDb();
      const salonRef = adminDb.collection("salons").doc(salonId);
      const salonSnap = await salonRef.get();
      if (!salonSnap.exists) {
        return res.status(404).json({ error: `Salão com ID '${salonId}' não foi localizado.` });
      }

      const salonData = salonSnap.data() as any;

      // Verificar papel do usuário
      let userRole = decodedToken?.role;
      if (!userRole) {
        const userSnap = await adminDb.collection("users").doc(verifiedUserId).get();
        if (userSnap.exists) {
          userRole = userSnap.data()?.role;
        }
      }

      const isPlatformAdmin = userRole === "platform_admin" || decodedToken?.email === process.env.VITE_PLATFORM_ADMIN_EMAIL;
      const isOwnerOrManager = salonData.ownerId === verifiedUserId || userRole === "owner" || userRole === "manager";

      if (!isPlatformAdmin && !isOwnerOrManager) {
        return res.status(403).json({ error: "Apenas administradores, owners ou managers do estabelecimento podem alterar assinaturas." });
      }

      // Obter ID de preço conforme o plano solicitado
      let priceId = "";
      switch (plan) {
        case 'start': priceId = process.env.STRIPE_PRICE_START || ''; break;
        case 'studio': priceId = process.env.STRIPE_PRICE_STUDIO || ''; break;
        case 'performance': priceId = process.env.STRIPE_PRICE_PERFORMANCE || ''; break;
        case 'network': priceId = process.env.STRIPE_PRICE_NETWORK || ''; break;
        case 'founder': priceId = process.env.STRIPE_PRICE_FOUNDER || ''; break;
        default:
          return res.status(400).json({ error: `Plano indefinido no Stripe: ${plan}` });
      }

      if (!priceId) {
        return res.status(400).json({ error: `O plano '${plan}' não possui um preço ID (STRIPE_PRICE_${plan.toUpperCase()}) configurado nas variáveis de ambiente do servidor.` });
      }

      const stripe = getStripe();

      // Robust fallback: if the configured ID is a Product ID (starts with "prod_"),
      // dynamically fetch the first active price ID associated with that product from Stripe.
      if (priceId.startsWith('prod_')) {
        console.log(`[Stripe Sync] Detectado Stripe Product ID '${priceId}' para o plano '${plan}'. Buscando preço ativo correspondente...`);
        try {
          const prices = await stripe.prices.list({
            product: priceId,
            active: true,
            limit: 1,
          });
          if (prices && prices.data && prices.data.length > 0) {
            const foundPriceId = prices.data[0].id;
            console.log(`[Stripe Sync] Sucesso: Encontrado Price ID '${foundPriceId}' para o produto '${priceId}'`);
            priceId = foundPriceId;
          } else {
            return res.status(400).json({ 
              error: `O ID '${priceId}' configurado está registrado como um Produto (Product ID), mas não há nenhum preço ativo/configurado para ele no Stripe Dashboard.` 
            });
          }
        } catch (priceErr: any) {
          console.error(`Erro ao consultar preços para o produto '${priceId}':`, priceErr);
          return res.status(500).json({ 
            error: `Erro ao buscar preços para o produto cadastrado: ${priceErr.message || priceErr}` 
          });
        }
      }
      let stripeCustomerId = salonData.stripeCustomerId;
      if (!stripeCustomerId) {
        // Criar novo cliente no Stripe
        const customer = await stripe.customers.create({
          email: salonData.ownerEmail || decodedToken?.email || "",
          name: salonData.name || "",
          metadata: {
            salonId,
            ownerId: salonData.ownerId || "",
          }
        });
        stripeCustomerId = customer.id;
        await salonRef.update({ stripeCustomerId });
      }

      // Detectar origem dinâmica para suportar redirecionamentos de retorno fluidos no preview e deploy
      const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
      const appUrl = process.env.APP_URL || origin || "http://localhost:3000";

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer: stripeCustomerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/dashboard?checkout=success`,
        cancel_url: `${appUrl}/dashboard?checkout=cancel`,
        metadata: {
          salonId,
          plan,
          userId: verifiedUserId,
        },
        subscription_data: {
          metadata: {
            salonId,
            plan,
          }
        }
      });

      return res.json({ checkoutUrl: session.url });
    } catch (err: any) {
      console.error("Erro ao criar sessão de checkout Stripe:", err);
      return res.status(500).json({ error: err.message || "Erro interno ao gerar checkout session." });
    }
  });

  // 2. Criar Portal Session para Gerenciamento
  app.post("/api/stripe/create-portal-session", async (req, res) => {
    try {
      const { salonId } = req.body;
      if (!salonId) {
        return res.status(400).json({ error: "ID do salão é obrigatório." });
      }

      const adminDb = getAdminDb();
      const salonSnap = await adminDb.collection("salons").doc(salonId).get();
      if (!salonSnap.exists) {
        return res.status(404).json({ error: "Estabelecimento não encontrado." });
      }

      const salonData = salonSnap.data() as any;
      const stripeCustomerId = salonData.stripeCustomerId;
      if (!stripeCustomerId) {
        return res.status(400).json({ error: "Este salão ainda não possui cadastro ou cartão vinculado no Stripe." });
      }

      const stripe = getStripe();
      const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
      const appUrl = process.env.APP_URL || origin || "http://localhost:3000";
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${appUrl}/dashboard`,
      });

      return res.json({ url: portalSession.url });
    } catch (err: any) {
      console.error("Erro ao estruturar Portal do Cliente no Stripe:", err);
      return res.status(500).json({ error: err?.message || "Erro ao carregar portal de auto-gerenciamento da assinatura." });
    }
  });

  // 3. Webhook de Processamento e Sincronização em Tempo Real (Stripe)
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      console.warn("[Lumiere Webhook] Assinatura ausente ou secret de webhook Stripe não configurada.");
      return res.status(400).send("Assinatura obrigatória ou segredo de assinatura ausente.");
    }

    let event: Stripe.Event;

    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
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
            await adminDb.collection("salons").doc(salonId).update({
              stripeCustomerId: stripeCustomerId || "",
              stripeSubscriptionId: stripeSubscriptionId || "",
              billingProvider: "stripe",
              billingMode: "recurring_card",
              subscriptionStatus: "active",
              paymentStatus: "paid",
              updatedAt: Date.now(),
            });
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

          let salonRef: admin.firestore.DocumentReference | null = null;
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
              subscriptionStatus: mappedStatus as any,
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

              // Atualizar salão
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

              // Criar subcoleção pagamento
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

      return res.json({ received: true });
    } catch (err: any) {
      console.error(`[Lumiere Webhook Execute Error] Erro ao gravar alterações: ${err.message}`);
      return res.status(500).send(`Erro interno de persistência: ${err.message}`);
    }
  });

  // Configuração do Vite middleware ou arquivos estáticos dependendo do ambiente
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Fallback de SPA para desenvolvimento: Serve o index.html transformado pelo Vite em qualquer rota indefinida
    app.use("*", async (req, res, next) => {
      if (req.originalUrl.startsWith("/api") || req.originalUrl.includes(".")) {
        return next();
      }
      try {
        const fs = await import("fs");
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        // Transforma o index.html injetando as rotas dinâmicas do cliente e as referências do Vite
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    // Servir arquivos de build em produção
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Lumière Server] Servidor executando em http://localhost:${PORT}`);
  });
}

startServer();
