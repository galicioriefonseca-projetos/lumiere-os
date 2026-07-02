import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAdminDb } from "../_shared/firebaseAdmin.js";
import { asaasRequest } from "../_shared/asaasClient";
import { verifyIdToken, canManageBilling } from "../_shared/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // 1. Verificar autenticação
    let user;
    try {
      user = await verifyIdToken(req);
    } catch (authErr: any) {
      console.error("[Asaas Customer Serverless] Erro de autenticação:", authErr);
      return res.status(401).json({ error: authErr.message || "Sessão inválida ou expirada." });
    }

    const { salonId, name, email, phone, document } = req.body || {};
    if (!salonId || !name || !document) {
      return res.status(400).json({ error: "salonId, name e document (CPF/CNPJ) são campos obrigatórios." });
    }

    const adminDb = getAdminDb();
    const salonRef = adminDb.collection("salons").doc(salonId);
    const salonDoc = await salonRef.get();

    if (!salonDoc.exists) {
      return res.status(404).json({ error: "Salão não encontrado no banco de dados." });
    }

    const salonData = salonDoc.data();

    // 2. Verificar permissão de faturamento
    const authResult = await canManageBilling(user, salonId, salonData);
    console.log(`[Asaas Customer Serverless] UID: ${user.uid} | Salon: ${salonId} | Role: ${authResult.role || "Nenhuma"} | Autorizado: ${authResult.authorized}`);
    if (!authResult.authorized) {
      return res.status(403).json({ error: authResult.reason || "Você não tem permissão para gerenciar o faturamento deste salão." });
    }

    // 3. Idempotência: Se já houver um asaasCustomerId, retornar as informações correspondentes
    if (salonData?.asaasCustomerId) {
      console.log(`[Asaas Customer Serverless] Salão ${salonId} já possui cliente Asaas associado: ${salonData.asaasCustomerId}`);
      return res.status(200).json({
        id: salonData.asaasCustomerId,
        externalId: salonData.asaasCustomerId,
        salonId,
        name: salonData.ownerName || name,
        email: salonData.ownerEmail || email,
        phone: salonData.phone || phone,
        document: salonData.document || document,
        createdAt: new Date(salonData.createdAt || Date.now()),
        updatedAt: new Date(),
      });
    }

    // 4. Criar o cliente no Asaas
    const payload = {
      name,
      email,
      phone,
      mobilePhone: phone,
      cpfCnpj: document.replace(/\D/g, ""), // Remove caracteres não numéricos
      externalReference: salonId,
      notificationDisabled: true, // silenciar alertas automáticos diretos do painel Asaas
    };

    const asaasCustomer = await asaasRequest("POST", "/customers", payload);

    // 5. Atualizar o Firestore
    await salonRef.update({
      asaasCustomerId: asaasCustomer.id,
      updatedAt: Date.now(),
    });

    console.log(`[Asaas Customer Serverless] Cliente criado com sucesso para o salão ${salonId}: ${asaasCustomer.id}`);
    return res.status(200).json({
      id: asaasCustomer.id,
      externalId: asaasCustomer.id,
      salonId,
      name: asaasCustomer.name,
      email: asaasCustomer.email,
      phone: asaasCustomer.phone,
      document: asaasCustomer.cpfCnpj,
      createdAt: new Date(asaasCustomer.dateCreated),
      updatedAt: new Date(),
    });
  } catch (err: any) {
    console.error("[Asaas Customer Serverless] Falha ao processar:", err);
    return res.status(500).json({ error: err.message || "Falha ao criar cliente no Asaas." });
  }
}
