import { getAdminAuth, getAdminDb, getStripe } from './_utils';

export default async function handler(req: any, res: any) {
  try {
    // Configuração para habilitar requisições do frontend de forma fluida
    const allowedOrigin = process.env.APP_URL || req.headers.origin || 'http://localhost:3000';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido. Utilize o método POST." });
    }

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
        const adminAuth = getAdminAuth();
        decodedToken = await adminAuth.verifyIdToken(idToken);
      } catch (err) {
        console.warn("[Stripe API] Token de autenticação Bearer expirado ou inválido, usando ID alternativo: ", err);
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

    if (priceId.startsWith('prod_')) {
      console.log(`[Stripe Vercel API] Buscando preço real para o produto '${priceId}'...`);
      try {
        const prices = await stripe.prices.list({
          product: priceId,
          active: true,
          limit: 1,
        });
        if (prices && prices.data && prices.data.length > 0) {
          priceId = prices.data[0].id;
        } else {
          return res.status(400).json({ 
            error: `O ID '${priceId}' configurado está registrado como um Produto, mas não há nenhum preço ativo associado a ele no Stripe Dashboard.` 
          });
        }
      } catch (priceErr: any) {
        return res.status(500).json({ 
          error: `Erro ao buscar preços ativos para o produto no Stripe: ${priceErr.message || priceErr}` 
        });
      }
    }

    let stripeCustomerId = salonData.stripeCustomerId;
    if (!stripeCustomerId) {
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

    return res.status(200).json({ checkoutUrl: session.url });
  } catch (err: any) {
    console.error("Erro na Vercel API /stripe/create-checkout-session:", err);
    return res.status(500).json({ error: err.message || "Erro interno ao gerar checkout session." });
  }
}
