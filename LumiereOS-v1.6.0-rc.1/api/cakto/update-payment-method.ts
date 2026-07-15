import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../_shared/firebaseAdmin.js";
import { verifyIdToken, canManageBilling } from "../_shared/auth.js";

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

    // Retornar imediatamente informando que requer suporte assistido
    return res.status(200).json({
      success: false,
      requiresSupport: true,
      message: "A alteração desta forma de pagamento requer configuração assistida pela equipe financeira."
    });

  } catch (err: any) {
    console.error("[Cakto Payment Method Serverless] Erro:", err);
    return res.status(500).json({ error: "Erro interno ao atualizar método de pagamento.", code: "PAYMENT_METHOD_FAILED" });
  }
}
