import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../_shared/firebaseAdmin.js";
import { verifyIdToken, resolvePlatformAdmin } from "../_shared/auth.js";

interface CaktoSettings {
  productId: string;
  startOfferId: string;
  founderOfferId: string;
  performanceOfferId: string;
  networkOfferId: string;
  enterpriseOfferId: string;
  updatedAt?: number;
}

function getCaktoApiBaseUrl() {
  const raw = process.env.CAKTO_API_URL || "https://api.cakto.com.br";
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch (e) {
    return "https://api.cakto.com.br";
  }
}

async function getCaktoAccessToken(): Promise<string> {
  const clientId = process.env.CAKTO_CLIENT_ID;
  const clientSecret = process.env.CAKTO_CLIENT_SECRET;
  const apiUrl = getCaktoApiBaseUrl();

  if (!clientId || !clientSecret) {
    throw new Error("CAKTO_CLIENT_ID ou CAKTO_CLIENT_SECRET não configurados no servidor.");
  }

  const url = `${apiUrl}/public_api/token/`;
  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter token da Cakto. Status: ${response.status}`);
  }

  const data = await response.json();
  if (!data || !data.access_token) {
    throw new Error("Token de acesso não encontrado na resposta do Cakto.");
  }

  return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // 1. Autenticação e Autorização
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (authErr: any) {
      return res.status(401).json({ error: authErr.message || "Sessão inválida ou expirada." });
    }

    const adminDb = getAdminDb();
    const platformAdmin = await resolvePlatformAdmin(user, adminDb);
    if (!platformAdmin) {
      return res.status(403).json({ error: "Acesso restrito a administradores da plataforma." });
    }

    // 2. Obter token de acesso da Cakto
    const accessToken = await getCaktoAccessToken();
    const apiUrl = getCaktoApiBaseUrl();

    const docRef = adminDb.collection("settings").doc("cakto");
    const docSnap = await docRef.get();

    let currentSettings: CaktoSettings = {
      productId: "",
      startOfferId: "",
      founderOfferId: "",
      performanceOfferId: "",
      networkOfferId: "",
      enterpriseOfferId: ""
    };

    if (docSnap.exists) {
      const d = docSnap.data();
      currentSettings = {
        productId: d?.productId || "",
        startOfferId: d?.startOfferId || "",
        founderOfferId: d?.founderOfferId || "",
        performanceOfferId: d?.performanceOfferId || "",
        networkOfferId: d?.networkOfferId || "",
        enterpriseOfferId: d?.enterpriseOfferId || ""
      };
    }

    let productId = currentSettings.productId;

    // Se não tiver Product ID configurado, tenta listar e encontrar o produto por nome
    if (!productId) {
      console.log("[Cakto Sync] Buscando produto 'LumièreOS'...");
      const productsRes = await fetch(`${apiUrl}/public_api/products/`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        const products = Array.isArray(productsData) ? productsData : productsData.results || [];
        const targetProduct = products.find((p: any) => {
          const name = String(p.name || p.title || "").toLowerCase();
          return name.includes("lumièreos") || name.includes("lumiereos");
        });

        if (targetProduct) {
          productId = targetProduct.id;
          console.log(`[Cakto Sync] Produto encontrado de forma automática: ${productId}`);
        }
      }
    }

    if (!productId) {
      return res.status(400).json({ error: "Product ID não configurado e nenhum produto 'LumièreOS' foi localizado na Cakto." });
    }

    // 3. Listar checkouts do produto
    console.log(`[Cakto Sync] Buscando checkouts para o produto ${productId}...`);
    const checkoutsRes = await fetch(`${apiUrl}/public_api/products/${productId}/checkouts/`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!checkoutsRes.ok) {
      return res.status(checkoutsRes.status).json({ error: `Falha ao listar checkouts da Cakto. Status: ${checkoutsRes.status}` });
    }

    const checkoutsData = await checkoutsRes.json();
    const checkouts = Array.isArray(checkoutsData) ? checkoutsData : checkoutsData.results || [];

    let startOfferId = currentSettings.startOfferId;
    let founderOfferId = currentSettings.founderOfferId;
    let performanceOfferId = currentSettings.performanceOfferId;
    let networkOfferId = currentSettings.networkOfferId;
    let enterpriseOfferId = currentSettings.enterpriseOfferId;

    console.log(`[Cakto Sync] Foram encontrados ${checkouts.length} checkouts. Iniciando varredura de detalhes...`);

    // 4. Buscar detalhes de cada checkout e mapear
    for (const item of checkouts) {
      const checkoutId = item.id;
      if (!checkoutId) continue;

      try {
        const detailRes = await fetch(`${apiUrl}/public_api/products/${productId}/checkouts/${checkoutId}/`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        });

        if (detailRes.ok) {
          const checkout = await detailRes.json();

          // REQUIREMENT #1: faça um console.log(JSON.stringify(checkout, null, 2)) antes de extrair o Offer ID
          console.log(JSON.stringify(checkout, null, 2));

          // Extração do Offer ID de forma flexível e robusta
          let offerId = "";
          if (checkout.offer_id) offerId = String(checkout.offer_id);
          else if (checkout.offerId) offerId = String(checkout.offerId);
          else if (checkout.offers) {
            if (Array.isArray(checkout.offers) && checkout.offers.length > 0) {
              const first = checkout.offers[0];
              offerId = String(typeof first === "object" ? (first.id || first.offer_id || first.offerId || "") : first);
            } else if (typeof checkout.offers === "object") {
              offerId = String(checkout.offers.id || checkout.offers.offer_id || checkout.offers.offerId || "");
            } else {
              offerId = String(checkout.offers);
            }
          } else if (checkout.default_offer_id) {
            offerId = String(checkout.default_offer_id);
          }

          if (!offerId) continue;

          // REQUIREMENT #4: Mapear ofertas por nome:
          // - “Start” => startOfferId
          // - “Founder” ou “Pioneiro” => founderOfferId
          // - “Performance” => performanceOfferId
          // - “Network” => networkOfferId
          // - “Enterprise” => enterpriseOfferId
          const name = String(checkout.name || checkout.title || "").toLowerCase();

          if (name.includes("start")) {
            startOfferId = offerId;
          } else if (name.includes("founder") || name.includes("pioneiro")) {
            founderOfferId = offerId;
          } else if (name.includes("performance")) {
            performanceOfferId = offerId;
          } else if (name.includes("network")) {
            networkOfferId = offerId;
          } else if (name.includes("enterprise")) {
            enterpriseOfferId = offerId;
          }
        }
      } catch (errDetail) {
        console.error(`[Cakto Sync] Erro ao obter detalhes do checkout ${checkoutId}:`, errDetail);
      }
    }

    const updatedSettings: CaktoSettings = {
      productId,
      startOfferId,
      founderOfferId,
      performanceOfferId,
      networkOfferId,
      enterpriseOfferId,
      updatedAt: Date.now()
    };

    await docRef.set(updatedSettings, { merge: true });

    return res.status(200).json({
      success: true,
      message: "Sincronização realizada com sucesso!",
      settings: updatedSettings
    });

  } catch (err: any) {
    console.error("[Cakto Sync API Error] Falha de sincronização:", err);
    return res.status(500).json({ error: "Erro interno de sincronização.", code: "CAKTO_SYNC_FAILED" });
  }
}
