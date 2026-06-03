export default async function handler(req: any, res: any) {
  // Configurar CORS de forma nativa e segura
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;
  const firebaseAdminConfigured = !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
  const hasFounderPrice = !!process.env.STRIPE_PRICE_FOUNDER;
  const appUrlConfigured = !!process.env.APP_URL;

  return res.status(200).json({
    ok: true,
    stripeConfigured,
    firebaseAdminConfigured,
    appUrlConfigured,
    hasFounderPrice
  });
}
