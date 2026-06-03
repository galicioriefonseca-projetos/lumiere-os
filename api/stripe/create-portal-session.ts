import { getAdminAuth, getAdminDb, getStripe } from './_utils';

export default async function handler(req: any, res: any) {
  // Configurar CORS de forma nativa e segura
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

  try {
    const { salonId } = req.body;
    if (!salonId) {
      return res.status(400).json({ error: "ID do salão é obrigatório." });
    }

    // Validar autenticação do usuário obrigatoriamente através de Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticação obrigatório.' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken).catch(() => null);
    if (!decodedToken) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    const verifiedUserId = decodedToken.uid;

    const adminDb = getAdminDb();
    const salonSnap = await adminDb.collection("salons").doc(salonId).get();
    if (!salonSnap.exists) {
      return res.status(404).json({ error: "Estabelecimento não encontrado." });
    }

    const salonData = salonSnap.data() as any;

    // Verificar papel e permissão do usuário
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
      return res.status(403).json({ error: "Acesso negado. Apenas administradores, donos ou gerentes do estabelecimento podem gerenciar o portal financeiro." });
    }

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

    return res.status(200).json({ url: portalSession.url });
  } catch (err: any) {
    console.error("Erro na Vercel API /stripe/create-portal-session:", err);
    return res.status(500).json({ error: err.message || "Erro interno ao estruturar portal session." });
  }
}
