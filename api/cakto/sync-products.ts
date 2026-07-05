import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../_shared/firebaseAdmin.js";
import { verifyIdToken } from "../_shared/auth.js";

interface CaktoSettings {
  productId: string;
  founderOfferId: string;
  studioOfferId: string;
  performanceOfferId: string;
  networkOfferId: string;
  updatedAt?: number;
}

async function isPlatformAdminUser(user: any): Promise<boolean> {
  if (!user || !user.uid) return false;
  const email = user.email;
  const uid = user.uid;
  const platformAdminEmail = process.env.VITE_PLATFORM_ADMIN_EMAIL || process.env.PLATFORM_ADMIN_EMAIL || "admin@lumiereos.com";
  if (email && email === platformAdminEmail) {
    return true;
  }
  const adminDb = getAdminDb();
  try {
    const platformAdminSnap = await adminDb.collection("platformAdmins").doc(uid).get();
    if (platformAdminSnap.exists) {
      return true;
    }
    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (userSnap.exists && userSnap.data()?.role === "platform_admin") {
      return true;
    }
  } catch (err) {
    console.warn(`[Cakto Admin Check Sync] Erro ao consultar privilégios de plataforma para ${uid}:`, err);
  }
  return false;
}

function extractOfferId(details: any): string {
  if (!details) return "";
  if (details.offer_id) return String(details.offer_id);
  if (details.offerId) return String(details.offerId);
  
  if (details.offers) {
    if (Array.isArray(details.offers)) {
      if (details.offers.length > 0) {
        const first = details.offers[0];
        if (first && typeof first === "object") {
          return String(first.id || first.offer_id || first.offerId || "");
        }
        return String(first);
      }
    } else if (typeof details.offers === "object") {
      return String(details.offers.id || details.offers.offer_id || details.offers.offerId || "");
    } else {
      return String(details.offers);
    }
  }
  
  if (details.default_offer_id) return String(details.default_offer_id);
  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // 1. Autenticação do usuário Firebase
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (authErr: any) {
      return res.status(401).json({ error: authErr.message || "Sessão inválida ou expirada." });
    }

    // 2. Validação se o usuário é Platform Admin
    const isPlatformAdmin = await isPlatformAdminUser(user);
    if (!isPlatformAdmin) {
      return res.status(403).json({ error: "Acesso restrito a administradores da plataforma." });
    }

    const clientId = process.env.CAKTO_CLIENT_ID;
    const clientSecret = process.env.CAKTO_CLIENT_SECRET;
    const apiUrl = process.env.CAKTO_API_URL || "https://api.cakto.com.br";

    console.log("[Cakto Sync Serverless] Iniciando sincronização automática de produtos...");
    if (!clientId || !clientSecret) {
      return res.status(400).json({
        error: "CAKTO_CLIENT_ID ou CAKTO_CLIENT_SECRET não configurados no servidor."
      });
    }

    // 3. Obter token da Cakto (Fluxo correto de token)
    console.log("[Cakto Sync Serverless] Obtendo token de acesso...");
    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);

    const tokenRes = await fetch(`${apiUrl}/public_api/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return res.status(502).json({
        error: `Falha na autenticação com a API Cakto (status ${tokenRes.status}): ${errText}`
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return res.status(502).json({ error: "Token de acesso não retornado pela API da Cakto." });
    }

    // 4. Listar produtos
    console.log("[Cakto Sync Serverless] Listando produtos...");
    const productsRes = await fetch(`${apiUrl}/public_api/products/`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!productsRes.ok) {
      const errText = await productsRes.text();
      return res.status(502).json({ error: `Falha ao listar produtos na Cakto: ${errText}` });
    }

    const productsData = await productsRes.json();
    const products = Array.isArray(productsData) ? productsData : (productsData?.data || productsData?.results || []);

    // 5. Procurar produto cujo nome contenha "LumièreOS" ou "LumiereOS"
    const targetProduct = products.find((p: any) => {
      const name = String(p.name || p.title || "").toLowerCase();
      return name.includes("lumièreos") || name.includes("lumiereos");
    });

    if (!targetProduct) {
      return res.status(404).json({
        error: "Nenhum produto contendo 'LumièreOS' ou 'LumiereOS' foi localizado na sua conta da Cakto."
      });
    }

    const productId = String(targetProduct.id || targetProduct.productId || "");
    if (!productId) {
      return res.status(502).json({ error: "ID do produto LumièreOS não encontrado no payload da Cakto." });
    }

    // 6. Listar checkouts do produto
    console.log(`[Cakto Sync Serverless] Listando checkouts para o produto ${productId}...`);
    const checkoutsRes = await fetch(`${apiUrl}/public_api/products/${productId}/checkouts/`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!checkoutsRes.ok) {
      const errText = await checkoutsRes.text();
      return res.status(502).json({ error: `Falha ao listar checkouts para o produto ${productId}: ${errText}` });
    }

    const checkoutsData = await checkoutsRes.json();
    const checkouts = Array.isArray(checkoutsData) ? checkoutsData : (checkoutsData?.data || checkoutsData?.results || []);

    if (checkouts.length === 0) {
      return res.status(404).json({
        error: `Nenhum checkout configurado para o produto '${targetProduct.name || "LumièreOS"}' (ID: ${productId}) na Cakto.`
      });
    }

    // 7. Obter detalhes de cada checkout para extrair offerId e mapear por plano
    let founderOfferId = "";
    let studioOfferId = "";
    let performanceOfferId = "";
    let networkOfferId = "";

    const checkoutsWithDetails = [];
    for (const checkout of checkouts) {
      const checkoutId = checkout.id || checkout.checkoutId || "";
      if (!checkoutId) continue;
      
      try {
        const detailRes = await fetch(`${apiUrl}/public_api/products/${productId}/checkouts/${checkoutId}/`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        });
        
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          checkoutsWithDetails.push({
            id: checkoutId,
            name: String(detailData.name || checkout.name || detailData.title || checkout.title || ""),
            details: detailData
          });
        }
      } catch (err) {
        console.warn(`[Cakto Sync Serverless] Erro ao buscar detalhes do checkout ${checkoutId}:`, err);
      }
    }

    // Mapear por nome se houver correspondência
    for (const item of checkoutsWithDetails) {
      const offerId = extractOfferId(item.details);
      if (!offerId) continue;
      
      const nameLower = item.name.toLowerCase();
      if (nameLower.includes("founder")) {
        founderOfferId = offerId;
      } else if (nameLower.includes("studio")) {
        studioOfferId = offerId;
      } else if (nameLower.includes("performance")) {
        performanceOfferId = offerId;
      } else if (nameLower.includes("network")) {
        networkOfferId = offerId;
      }
    }

    // Fallback: Obter o checkout padrão ou o primeiro para ofertas que não bateram pelo nome
    const defaultItem = checkoutsWithDetails.find(item => {
      const d = item.details;
      return d.is_default || d.default || d.is_active;
    }) || checkoutsWithDetails[0];

    const fallbackOfferId = defaultItem ? extractOfferId(defaultItem.details) : "";

    if (!fallbackOfferId) {
      return res.status(502).json({
        error: "Não foi possível extrair nenhum Offer ID válido dos checkouts da Cakto para servir como fallback."
      });
    }

    if (!founderOfferId) founderOfferId = fallbackOfferId;
    if (!studioOfferId) studioOfferId = fallbackOfferId;
    if (!performanceOfferId) performanceOfferId = fallbackOfferId;
    if (!networkOfferId) networkOfferId = fallbackOfferId;

    // 8. Salvar no Firestore
    const adminDb = getAdminDb();
    const docRef = adminDb.collection("settings").doc("cakto");

    const syncData: CaktoSettings = {
      productId,
      founderOfferId,
      studioOfferId,
      performanceOfferId,
      networkOfferId,
      updatedAt: Date.now()
    };

    await docRef.set(syncData, { merge: true });
    console.log(`[Cakto Sync Serverless] Sincronização concluída com sucesso para o produto ${productId}.`);

    return res.status(200).json({
      success: true,
      message: "Sincronização realizada com sucesso!",
      settings: syncData,
      productName: targetProduct.name || "LumièreOS"
    });

  } catch (err: any) {
    console.error("[Cakto Sync Serverless] Erro crítico:", err);
    return res.status(500).json({ error: err.message || "Erro interno do servidor." });
  }
}
