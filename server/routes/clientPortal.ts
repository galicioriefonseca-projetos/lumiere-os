import { Router } from "express";
import { getAdminDb, getAdminAuth, isFirebaseAdminCredentialError } from "../firebaseAdmin.js";
import { verifyIdToken, resolvePlatformAdmin } from "../shared/auth.js";
import { env } from "../config/env.js";
import { withDeveloperAuth } from "../shared/gemini.js";
import crypto from "crypto";

export const clientPortalRoutes = Router();

// Helper para validar acesso do usuário ao tenant (salonId)
// Apenas a conta galicioriefonseca31@gmail.com e contas de agência têm acesso à gestão do portal
async function getAuthenticatedUserAndSalon(req: any, requireAgency: boolean = true) {
  const user = await verifyIdToken(req);
  const adminDb = getAdminDb();
  
  const userSnap = await adminDb.collection("users").doc(user.uid).get();
  const userData = userSnap.exists ? userSnap.data() : null;

  const isMaster = await resolvePlatformAdmin(user, adminDb);
  const salonId = userData?.salonId || (isMaster ? req.query?.salonId || req.body?.salonId : null);

  // Validação de acesso à agência / portal
  const userEmail = String(user.email || "").toLowerCase();
  const isOwnerEmail = userEmail === 'galicioriefonseca31@gmail.com' || userEmail === 'galicioriefonseca@gmail.com';
  let isAgency = isMaster || isOwnerEmail;

  if (!isAgency && salonId) {
    const salonSnap = await adminDb.collection("salons").doc(salonId).get();
    if (salonSnap.exists) {
      const sData = salonSnap.data() || {};
      const ownerEmail = String(sData.ownerEmail || '').toLowerCase();
      if (
        ownerEmail === 'galicioriefonseca31@gmail.com' ||
        ownerEmail === 'galicioriefonseca@gmail.com' ||
        sData.segment === 'agency' || 
        sData.businessType === 'agency' ||
        sData.enabledModules?.clientPortal === true ||
        ['owner', 'manager', 'platform_admin'].includes(userData?.role)
      ) {
        isAgency = true;
      }
    }
  }

  // Se a rota exige privilégio de gestão da agência:
  if (requireAgency) {
    if (!isAgency) {
      throw new Error("Acesso à gestão do Portal do Cliente exclusivo para a agência ou administrador.");
    }
  } else {
    // Acesso liberado para a agência ou cliente convidado da agência
    const isClient = userData?.role === 'client';
    if (!isAgency && !isClient) {
      throw new Error("Acesso exclusivo para clientes cadastrados ou gestores da agência.");
    }
  }

  return {
    user,
    userData,
    isMaster,
    isAgency,
    salonId: String(salonId || "").trim()
  };
}

// ----------------------------------------------------
// 1. RESOLVER CONVITE DO CLIENTE (PÚBLICO)
// ----------------------------------------------------
clientPortalRoutes.get("/resolve-invite", async (req, res) => {
  try {
    const token = String(req.query.token || req.query.inviteId || "").trim();
    if (!token) {
      return res.status(400).json({ error: "Token de convite não informado." });
    }

    const adminDb = getAdminDb();
    const inviteRef = adminDb.collection("invites").doc(token);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      // Tenta na subcoleção de fallback se houver
      return res.status(404).json({ error: "Convite não encontrado ou expirado." });
    }

    const inviteData = inviteSnap.data() || {};

    if (inviteData.inviteType !== "client" && inviteData.role !== "client") {
      return res.status(400).json({ error: "Este link não é um convite de Área do Cliente." });
    }

    if (inviteData.status === "canceled") {
      return res.status(410).json({ error: "Este convite foi cancelado pela agência." });
    }

    if (inviteData.expiresAt && Date.now() > inviteData.expiresAt) {
      return res.status(410).json({ error: "Este convite expirou. Solicite um novo link à agência." });
    }

    // Busca os dados da agência (salon)
    const salonSnap = await adminDb.collection("salons").doc(inviteData.salonId).get();
    const salonData = salonSnap.exists ? salonSnap.data() : null;

    return res.json({
      token,
      salonId: inviteData.salonId,
      agencyName: salonData?.name || "Agência de Marketing",
      agencyEmail: salonData?.ownerEmail || "",
      agencyPhone: salonData?.phone || "",
      clientName: inviteData.clientName || "",
      clientEmail: inviteData.clientEmail || "",
      companyName: inviteData.companyName || inviteData.clientName || "",
      status: inviteData.status || "pending"
    });
  } catch (error: any) {
    console.error("[ClientPortal resolve-invite]", error);
    return res.status(500).json({ error: "Erro ao validar convite." });
  }
});

// ----------------------------------------------------
// 2. ACEITAR CONVITE / CADASTRAR OU VINCULAR CLIENTE
// ----------------------------------------------------
clientPortalRoutes.post("/accept-invite", async (req, res) => {
  try {
    const { token, fullName, companyName, phone } = req.body || {};
    const user = await verifyIdToken(req);

    if (!token) {
      return res.status(400).json({ error: "Token de convite obrigatório." });
    }

    const adminDb = getAdminDb();
    const inviteRef = adminDb.collection("invites").doc(token);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      return res.status(404).json({ error: "Convite não localizado." });
    }

    const inviteData = inviteSnap.data() || {};
    if (inviteData.expiresAt && Date.now() > inviteData.expiresAt) {
      return res.status(410).json({ error: "Convite expirado." });
    }

    const salonId = inviteData.salonId;
    const now = Date.now();
    const finalClientName = fullName || inviteData.clientName || user.name || "Cliente";
    const finalCompanyName = companyName || inviteData.companyName || finalClientName;

    // 1. Atualizar ou criar o perfil do usuário como 'client'
    const userRef = adminDb.collection("users").doc(user.uid);
    await userRef.set({
      id: user.uid,
      email: user.email,
      fullName: finalClientName,
      phone: phone || inviteData.clientPhone || "",
      role: "client",
      salonId,
      companyName: finalCompanyName,
      onboardingStatus: "completed",
      isActive: true,
      updatedAt: now,
      createdAt: now
    }, { merge: true });

    // 2. Se houver clientId associado ao convite, vincula. Senão cria/atualiza registro na coleção de clientes da agência
    let clientId = inviteData.clientId;
    if (!clientId) {
      // Buscar se cliente já existe pelo email
      const existingClientsSnap = await adminDb.collection(`salons/${salonId}/clients`)
        .where("email", "==", user.email.toLowerCase())
        .limit(1)
        .get();

      if (!existingClientsSnap.empty) {
        clientId = existingClientsSnap.docs[0].id;
      } else {
        const newClientRef = adminDb.collection(`salons/${salonId}/clients`).doc();
        clientId = newClientRef.id;
        await newClientRef.set({
          id: clientId,
          name: finalCompanyName,
          contactName: finalClientName,
          email: user.email.toLowerCase(),
          phone: phone || inviteData.clientPhone || "",
          portalUserId: user.uid,
          portalAccessEnabled: true,
          portalRegisteredAt: now,
          status: "active",
          crmStage: "active",
          createdAt: now,
          updatedAt: now
        });
      }
    }

    // Vincula o clientId no documento do usuário
    await userRef.update({
      clientId
    });

    // 3. Marca o convite como aceito
    await inviteRef.update({
      status: "accepted",
      acceptedByUid: user.uid,
      acceptedByEmail: user.email,
      acceptedAt: now,
      clientId,
      updatedAt: now
    });

    return res.json({
      success: true,
      salonId,
      clientId,
      redirect: "/portal"
    });
  } catch (error: any) {
    console.error("[ClientPortal accept-invite]", error);
    return res.status(500).json({ error: error?.message || "Erro ao aceitar convite." });
  }
});

// ----------------------------------------------------
// 3. CRIAR CONVITE (AGÊNCIA)
// ----------------------------------------------------
clientPortalRoutes.post("/invites", async (req, res) => {
  try {
    const { salonId, isMaster, user } = await getAuthenticatedUserAndSalon(req);
    if (!salonId) {
      return res.status(403).json({ error: "Salão/Agência não vinculado." });
    }

    const { clientName, clientEmail, clientPhone, companyName, clientId, notes } = req.body || {};

    const adminDb = getAdminDb();
    const token = `cli_${crypto.randomBytes(16).toString("hex")}`;
    const now = Date.now();
    const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 dias

    // Busca nome da agência
    const salonSnap = await adminDb.collection("salons").doc(salonId).get();
    const salonData = salonSnap.data() || {};
    const agencyName = salonData.name || "Agência LumièreOS";

    const invitePayload = {
      inviteId: token,
      token,
      salonId,
      agencyName,
      inviteType: "client",
      role: "client",
      clientName: clientName || companyName,
      companyName: companyName || clientName,
      clientEmail: clientEmail ? String(clientEmail).trim().toLowerCase() : "",
      clientPhone: clientPhone || "",
      clientId: clientId || null,
      notes: notes || "",
      status: "pending",
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
      expiresAt
    };

    // Salva na coleção global de invites
    await adminDb.collection("invites").doc(token).set(invitePayload);

    // Salva também no histórico de convites da agência
    await adminDb.collection(`salons/${salonId}/client_invites`).doc(token).set(invitePayload);

    // Se houver um clientId associado, atualiza o cliente com o último convite gerado
    if (clientId) {
      await adminDb.collection(`salons/${salonId}/clients`).doc(clientId).set({
        lastInviteToken: token,
        lastInviteCreatedAt: now,
        portalAccessEnabled: true
      }, { merge: true });
    }

    return res.json({
      success: true,
      invite: invitePayload,
      inviteLink: `/portal/convite?token=${token}`
    });
  } catch (error: any) {
    console.error("[ClientPortal create-invite]", error);
    return res.status(500).json({ error: error?.message || "Erro ao criar convite." });
  }
});

// ----------------------------------------------------
// 3.1 CADASTRAR CLIENTE E GERAR CONVITE IMEDIATO
// ----------------------------------------------------
clientPortalRoutes.post("/clients-with-invite", async (req, res) => {
  try {
    const { salonId, user } = await getAuthenticatedUserAndSalon(req);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });

    const {
      name,
      contactName,
      email,
      phone,
      notes
    } = req.body || {};

    if (!name && !contactName) {
      return res.status(400).json({ error: "O nome do cliente ou da empresa é obrigatório." });
    }

    const adminDb = getAdminDb();
    const now = Date.now();
    const clientRef = adminDb.collection(`salons/${salonId}/clients`).doc();
    const token = `cli_${crypto.randomBytes(16).toString("hex")}`;
    const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 dias

    // Busca nome da agência
    const salonSnap = await adminDb.collection("salons").doc(salonId).get();
    const salonData = salonSnap.data() || {};
    const agencyName = salonData.name || "Agência LumièreOS";

    const finalName = (name || contactName).trim();
    const finalContact = (contactName || name).trim();
    const finalEmail = email ? String(email).trim().toLowerCase() : "";
    const finalPhone = phone ? String(phone).trim() : "";

    const clientPayload = {
      id: clientRef.id,
      name: finalName,
      contactName: finalContact,
      email: finalEmail,
      phone: finalPhone,
      notes: notes || "",
      crmStage: "active",
      status: "active",
      archived: false,
      portalAccessEnabled: true,
      lastInviteToken: token,
      lastInviteCreatedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: user.uid
    };

    await clientRef.set(clientPayload);

    const invitePayload = {
      inviteId: token,
      token,
      salonId,
      agencyName,
      inviteType: "client",
      role: "client",
      clientName: finalContact,
      companyName: finalName,
      clientEmail: finalEmail,
      clientPhone: finalPhone,
      clientId: clientRef.id,
      notes: notes || "",
      status: "pending",
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
      expiresAt
    };

    await adminDb.collection("invites").doc(token).set(invitePayload);
    await adminDb.collection(`salons/${salonId}/client_invites`).doc(token).set(invitePayload);

    return res.json({
      success: true,
      client: clientPayload,
      invite: invitePayload,
      inviteToken: token,
      inviteLink: `/portal/convite?token=${token}`
    });
  } catch (error: any) {
    console.error("[ClientPortal clients-with-invite]", error);
    return res.status(500).json({ error: error?.message || "Erro ao cadastrar cliente e gerar convite." });
  }
});

// ----------------------------------------------------
// 3.2 LISTAR CLIENTES DA AGÊNCIA (PARA SELEÇÃO DE RELATÓRIOS E PORTAL)
// ----------------------------------------------------
clientPortalRoutes.get("/clients", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });

    const adminDb = getAdminDb();
    const snap = await adminDb.collection(`salons/${salonId}/clients`).get();
    const clients: any[] = [];
    snap.forEach(doc => clients.push({ id: doc.id, ...doc.data() }));
    clients.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return res.json({ clients });
  } catch (error: any) {
    console.error("[ClientPortal get-clients]", error);
    return res.status(500).json({ error: "Erro ao obter clientes." });
  }
});

// ----------------------------------------------------
// 4. LISTAR CONVITES DA AGÊNCIA
// ----------------------------------------------------
clientPortalRoutes.get("/invites", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    if (!salonId) {
      return res.status(403).json({ error: "Agência não identificada." });
    }

    const adminDb = getAdminDb();
    const snap = await adminDb.collection("invites")
      .where("salonId", "==", salonId)
      .where("inviteType", "==", "client")
      .get();

    const invites: any[] = [];
    snap.forEach(doc => {
      invites.push({ id: doc.id, ...doc.data() });
    });

    invites.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return res.json({ invites });
  } catch (error: any) {
    console.error("[ClientPortal list-invites]", error);
    return res.status(500).json({ error: "Erro ao listar convites." });
  }
});

// ----------------------------------------------------
// 5. CANCELAR CONVITE DA AGÊNCIA
// ----------------------------------------------------
clientPortalRoutes.delete("/invites/:token", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    const { token } = req.params;

    if (!salonId || !token) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    const adminDb = getAdminDb();
    const inviteRef = adminDb.collection("invites").doc(token);
    const snap = await inviteRef.get();

    if (snap.exists && snap.data()?.salonId === salonId) {
      await inviteRef.update({
        status: "canceled",
        updatedAt: Date.now()
      });
      await adminDb.collection(`salons/${salonId}/client_invites`).doc(token).set({
        status: "canceled",
        updatedAt: Date.now()
      }, { merge: true });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[ClientPortal cancel-invite]", error);
    return res.status(500).json({ error: "Erro ao cancelar convite." });
  }
});

// ----------------------------------------------------
// 6. DADOS DO PORTAL DO CLIENTE (VISÃO DO CLIENTE LOGADO OU PREVIEW DA AGÊNCIA)
// ----------------------------------------------------
clientPortalRoutes.get("/client-view", async (req, res) => {
  try {
    const { salonId: authenticatedSalonId, user, userData } = await getAuthenticatedUserAndSalon(req, false);
    
    let finalSalonId = authenticatedSalonId;
    let finalClientId = userData?.clientId;
    let isPreview = false;

    const adminDb = getAdminDb();

    // Se for o dono da agência ou admin visualizando em modo preview:
    if (userData?.role === "owner" || userData?.role === "manager" || userData?.role === "platform_admin" || await resolvePlatformAdmin(user, adminDb)) {
      isPreview = true;
      if (req.query.salonId) finalSalonId = String(req.query.salonId);
      if (req.query.clientId) finalClientId = String(req.query.clientId);
    }

    if (!finalSalonId) {
      return res.status(403).json({ error: "Nenhuma agência associada a este usuário." });
    }

    // Busca agência
    const salonSnap = await adminDb.collection("salons").doc(finalSalonId).get();
    const salonData = salonSnap.data() || {};

    // Busca relatórios
    let reportsQuery = adminDb.collection(`salons/${finalSalonId}/reports`);
    const reportsSnap = await reportsQuery.get();
    let reports: any[] = [];
    reportsSnap.forEach(doc => {
      const data = doc.data();
      if (!isPreview) {
        if (data.status === "published" && (!data.clientId || data.clientId === finalClientId || (data.clientEmail && data.clientEmail.toLowerCase() === user.email.toLowerCase()))) {
          reports.push({ id: doc.id, ...data });
        }
      } else {
        if (!finalClientId || data.clientId === finalClientId) {
          reports.push({ id: doc.id, ...data });
        }
      }
    });
    reports.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Busca contratos
    const contractsSnap = await adminDb.collection(`salons/${finalSalonId}/contracts`).get();
    let contracts: any[] = [];
    contractsSnap.forEach(doc => {
      const data = doc.data();
      if (!isPreview) {
        if (!data.clientId || data.clientId === finalClientId || (data.clientEmail && data.clientEmail.toLowerCase() === user.email.toLowerCase())) {
          contracts.push({ id: doc.id, ...data });
        }
      } else {
        if (!finalClientId || data.clientId === finalClientId) {
          contracts.push({ id: doc.id, ...data });
        }
      }
    });
    contracts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Busca Aprovações
    const approvalsSnap = await adminDb.collection(`salons/${finalSalonId}/approvals`).get();
    const approvals: any[] = [];
    approvalsSnap.forEach(doc => {
        const data = doc.data();
        if (isPreview || data.clientId === finalClientId) approvals.push({ id: doc.id, ...data });
    });

    // Busca Tickets
    const ticketsSnap = await adminDb.collection(`salons/${finalSalonId}/tickets`).get();
    const tickets: any[] = [];
    ticketsSnap.forEach(doc => {
        const data = doc.data();
        if (isPreview || data.clientId === finalClientId) tickets.push({ id: doc.id, ...data });
    });

    // Busca Entregáveis
    const deliverablesSnap = await adminDb.collection(`salons/${finalSalonId}/deliverables`).get();
    const deliverables: any[] = [];
    deliverablesSnap.forEach(doc => {
        const data = doc.data();
        if (isPreview || data.clientId === finalClientId) deliverables.push({ id: doc.id, ...data });
    });

    // Busca informações do cliente
    let clientInfo: any = null;
    if (finalClientId) {
      const clientSnap = await adminDb.collection(`salons/${finalSalonId}/clients`).doc(finalClientId).get();
      if (clientSnap.exists) {
        clientInfo = clientSnap.data();
      }
    }

    return res.json({
      agency: {
        id: finalSalonId,
        name: salonData.name || "Agência de Marketing",
        ownerName: salonData.ownerName || "",
        phone: salonData.phone || "",
        email: salonData.ownerEmail || salonData.email || "",
        city: salonData.city || "",
        state: salonData.state || ""
      },
      client: {
        id: finalClientId || user.uid,
        name: userData?.companyName || clientInfo?.name || userData?.fullName || "Cliente",
        contactName: userData?.fullName || clientInfo?.contactName || "",
        email: user.email,
        phone: userData?.phone || clientInfo?.phone || ""
      },
      reports,
      contracts,
      approvals,
      tickets,
      deliverables,
      isPreview
    });
  } catch (error: any) {
    console.error("[ClientPortal client-view]", error);
    return res.status(500).json({ error: error?.message || "Erro ao carregar Área do Cliente." });
  }
});

// ----------------------------------------------------
// 7. CRUD DE RELATÓRIOS (AGÊNCIA)
// ----------------------------------------------------
clientPortalRoutes.get("/reports", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });

    const adminDb = getAdminDb();
    const snap = await adminDb.collection(`salons/${salonId}/reports`).get();
    const reports: any[] = [];
    snap.forEach(doc => reports.push({ id: doc.id, ...doc.data() }));
    reports.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return res.json({ reports });
  } catch (error: any) {
    console.error("[ClientPortal get-reports]", error);
    return res.status(500).json({ error: "Erro ao obter relatórios." });
  }
});

clientPortalRoutes.post("/reports", async (req, res) => {
  try {
    const { salonId, user } = await getAuthenticatedUserAndSalon(req);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });

    const {
      title,
      clientId,
      clientName,
      clientEmail,
      period,
      summary,
      reportType,
      metrics,
      gmbMetrics,
      externalUrl,
      fileUrl,
      status
    } = req.body || {};

    if (!title || !period) {
      return res.status(400).json({ error: "Título e período são obrigatórios." });
    }

    const adminDb = getAdminDb();
    const reportRef = adminDb.collection(`salons/${salonId}/reports`).doc();
    const now = Date.now();

    const reportData = {
      id: reportRef.id,
      salonId,
      clientId: clientId || null,
      clientName: clientName || "Geral",
      clientEmail: clientEmail || "",
      title: title.trim(),
      period: period.trim(),
      summary: summary || "",
      reportType: reportType || (gmbMetrics ? "google_meu_negocio" : "general"),
      metrics: {
        leads: Number(metrics?.leads || 0),
        reach: Number(metrics?.reach || 0),
        conversions: Number(metrics?.conversions || 0),
        investment: Number(metrics?.investment || 0),
        revenue: Number(metrics?.revenue || 0),
        roas: Number(metrics?.roas || 0),
        cpc: Number(metrics?.cpc || 0),
        cpl: Number(metrics?.cpl || 0)
      },
      gmbMetrics: gmbMetrics ? {
        directionRequests: Number(gmbMetrics.directionRequests || 0),
        calls: Number(gmbMetrics.calls || 0),
        websiteClicks: Number(gmbMetrics.websiteClicks || 0),
        mapsImpressions: Number(gmbMetrics.mapsImpressions || 0),
        searchImpressions: Number(gmbMetrics.searchImpressions || 0),
        rankingPosition: gmbMetrics.rankingPosition ? Number(gmbMetrics.rankingPosition) : undefined,
        targetKeyword: String(gmbMetrics.targetKeyword || "").trim(),
        topKeywords: Array.isArray(gmbMetrics.topKeywords) ? gmbMetrics.topKeywords : [],
        rating: gmbMetrics.rating ? Number(gmbMetrics.rating) : undefined,
        reviewsCount: gmbMetrics.reviewsCount ? Number(gmbMetrics.reviewsCount) : undefined
      } : null,
      externalUrl: externalUrl || "",
      fileUrl: fileUrl || "",
      status: status === "draft" ? "draft" : "published",
      publishedAt: status === "draft" ? null : now,
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now
    };

    await reportRef.set(reportData);
    return res.json({ success: true, report: reportData });
  } catch (error: any) {
    console.error("[ClientPortal create-report]", error);
    return res.status(500).json({ error: "Erro ao salvar relatório." });
  }
});

clientPortalRoutes.put("/reports/:id", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    const { id } = req.params;
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });

    const adminDb = getAdminDb();
    const reportRef = adminDb.collection(`salons/${salonId}/reports`).doc(id);
    const snap = await reportRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Relatório não encontrado." });

    const updatePayload: any = {
      ...req.body,
      updatedAt: Date.now()
    };
    delete updatePayload.id;
    delete updatePayload.salonId;

    await reportRef.update(updatePayload);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[ClientPortal update-report]", error);
    return res.status(500).json({ error: "Erro ao atualizar relatório." });
  }
});

clientPortalRoutes.delete("/reports/:id", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    const { id } = req.params;
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });

    const adminDb = getAdminDb();
    await adminDb.collection(`salons/${salonId}/reports`).doc(id).delete();
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[ClientPortal delete-report]", error);
    return res.status(500).json({ error: "Erro ao excluir relatório." });
  }
});

// ----------------------------------------------------
// 7.1 RECONHECIMENTO AUTOMÁTICO DE PDF (GEMINI AI)
// ----------------------------------------------------
clientPortalRoutes.post("/reports/parse-pdf", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });

    const { pdfBase64, fileName, clientId } = req.body || {};
    if (!pdfBase64) {
      return res.status(400).json({ error: "Arquivo PDF em formato Base64 não fornecido." });
    }

    const apiKey = env.gemini.apiKey;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("SUA_API_KEY")) {
      return res.status(400).json({
        error: "Chave de API do Gemini não configurada. Configure GEMINI_API_KEY nas variáveis de ambiente."
      });
    }

    // Limpar prefixo data:application/pdf;base64, caso venha de FileReader
    const cleanBase64 = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;

    const parsedData = await withDeveloperAuth(apiKey, async (ai) => {
      const prompt = `Você é um analista sênior de inteligência de dados especializado em relatórios de desempenho do Google Meu Negócio (Google Business Profile - GBP) e Google Maps.
Analise detalhadamente o documento PDF anexo fornecido pelo Google.
Extraia com máxima fidelidade todas as métricas de performance da empresa presentes no documento (visualizações de busca, mapas, chamadas telefônicas, solicitações de rotas/direções, acessos ao site, nota de estrelas e avaliações).
Retorne ESTRITAMENTE um objeto JSON válido (sem blocos markdown e sem textos adicionais antes ou depois) com a estrutura exata:
{
  "businessName": string,
  "period": string,
  "month": number,
  "year": number,
  "searchImpressions": number,
  "mapsImpressions": number,
  "totalImpressions": number,
  "websiteClicks": number,
  "directionRequests": number,
  "calls": number,
  "rating": number,
  "reviewsCount": number,
  "targetKeyword": string,
  "topKeywords": [
    { "keyword": string, "count": number }
  ],
  "summary": string
}
Regras:
1. "businessName": Nome comercial do estabelecimento indicado no cabeçalho ou título do relatório.
2. "period": Mês e ano de referência por extenso em português (ex: "Outubro / 2026", "Setembro / 2026").
3. "month": Número do mês (1 a 12).
4. "year": Ano (ex: 2026).
5. "searchImpressions": Total de pessoas que viram o perfil na Pesquisa Google.
6. "mapsImpressions": Total de pessoas que viram o perfil no Google Maps.
7. "totalImpressions": Total de impressões ou visualizações gerais do perfil.
8. "websiteClicks": Quantidade de cliques que levaram para o site da empresa.
9. "directionRequests": Quantidade de solicitações de rotas / direções no mapa.
10. "calls": Ligações diretas iniciadas a partir do perfil no Google.
11. "rating": Média geral de estrelas (ex: 4.9 ou 5.0).
12. "reviewsCount": Quantidade total de avaliações recebidas.
13. "targetKeyword": Palavra-chave principal que mais gerou impressões.
14. "topKeywords": Lista das principais buscas com contagem aproximada.
15. "summary": Um resumo executivo analítico impecável em português do Brasil (3 a 5 frases), destacando o crescimento de visibilidade, as principais ações dos clientes (chamadas, rotas, visitas ao site) e recomendações para o próximo mês.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: cleanBase64
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text || '';
      try {
        return JSON.parse(responseText.trim());
      } catch (e) {
        const match = responseText.match(/\{[\s\S]*\}/);
        if (match) {
          return JSON.parse(match[0]);
        }
        throw new Error('Falha ao interpretar o JSON retornado pela inteligência artificial.');
      }
    });

    // Se tiver clientId ou se puder inferir o cliente pelo nome, buscar relatórios anteriores para calcular o Comparativo de Meses
    const adminDb = getAdminDb();
    let targetClientId = clientId;

    if (!targetClientId && parsedData.businessName) {
      const clientsSnap = await adminDb.collection(`salons/${salonId}/clients`).get();
      clientsSnap.forEach(doc => {
        const cData = doc.data();
        const cName = String(cData.name || '').toLowerCase();
        const pName = String(parsedData.businessName || '').toLowerCase();
        if (cName.includes(pName) || pName.includes(cName)) {
          targetClientId = doc.id;
        }
      });
    }

    let comparison = null;
    if (targetClientId) {
      const priorReportsSnap = await adminDb.collection(`salons/${salonId}/reports`)
        .where("clientId", "==", targetClientId)
        .get();

      const existingReports: any[] = [];
      priorReportsSnap.forEach(doc => {
        existingReports.push({ id: doc.id, ...doc.data() });
      });

      existingReports.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      if (existingReports.length > 0) {
        const prev = existingReports[0];
        const prevGmb = prev.gmbMetrics || {};
        const prevCalls = prevGmb.calls || prev.metrics?.leads || 0;
        const prevRoutes = prevGmb.directionRequests || 0;
        const prevWeb = prevGmb.websiteClicks || 0;
        const prevSearch = prevGmb.searchImpressions || 0;
        const prevMaps = prevGmb.mapsImpressions || 0;

        const calcDiff = (curr: number, prior: number) => {
          if (!prior || prior === 0) return curr > 0 ? 100 : 0;
          return Number((((curr - prior) / prior) * 100).toFixed(1));
        };

        comparison = {
          previousPeriod: prev.period || 'Mês anterior',
          callsDiffPct: calcDiff(parsedData.calls || 0, prevCalls),
          directionRequestsDiffPct: calcDiff(parsedData.directionRequests || 0, prevRoutes),
          websiteClicksDiffPct: calcDiff(parsedData.websiteClicks || 0, prevWeb),
          searchImpressionsDiffPct: calcDiff(parsedData.searchImpressions || 0, prevSearch),
          mapsImpressionsDiffPct: calcDiff(parsedData.mapsImpressions || 0, prevMaps),
          reviewsDiff: (parsedData.reviewsCount || 0) - (prevGmb.reviewsCount || 0)
        };
      }
    }

    return res.json({
      success: true,
      parsedData,
      comparison,
      detectedClientId: targetClientId || null
    });
  } catch (error: any) {
    console.error("[ClientPortal parse-pdf] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao processar PDF com IA." });
  }
});

// ----------------------------------------------------
// 7.2 COMPARATIVO MENSAL HISTÓRICO DE RELATÓRIOS
// ----------------------------------------------------
clientPortalRoutes.get("/reports/comparison", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req, false);
    const clientId = req.query.clientId as string;

    if (!salonId || !clientId) {
      return res.status(400).json({ error: "salonId e clientId são obrigatórios." });
    }

    const adminDb = getAdminDb();
    const reportsSnap = await adminDb.collection(`salons/${salonId}/reports`)
      .where("clientId", "==", clientId)
      .where("status", "==", "published")
      .get();

    const reports: any[] = [];
    reportsSnap.forEach(doc => {
      reports.push({ id: doc.id, ...doc.data() });
    });

    // Ordenar do mais antigo ao mais recente
    reports.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    const calcDiff = (curr: number, prior: number) => {
      if (!prior || prior === 0) return curr > 0 ? 100 : 0;
      return Number((((curr - prior) / prior) * 100).toFixed(1));
    };

    // Calcular evolução mês a mês
    const reportsWithComparison = reports.map((rep, index) => {
      if (index === 0) {
        return {
          ...rep,
          isBaseline: true,
          comparison: null
        };
      }

      const prev = reports[index - 1];
      const prevGmb = prev.gmbMetrics || {};
      const currGmb = rep.gmbMetrics || {};

      const callsDiff = calcDiff(currGmb.calls || 0, prevGmb.calls || 0);
      const routesDiff = calcDiff(currGmb.directionRequests || 0, prevGmb.directionRequests || 0);
      const websiteDiff = calcDiff(currGmb.websiteClicks || 0, prevGmb.websiteClicks || 0);
      const searchDiff = calcDiff(currGmb.searchImpressions || 0, prevGmb.searchImpressions || 0);
      const mapsDiff = calcDiff(currGmb.mapsImpressions || 0, prevGmb.mapsImpressions || 0);
      const reviewsDiff = (currGmb.reviewsCount || 0) - (prevGmb.reviewsCount || 0);

      return {
        ...rep,
        isBaseline: false,
        comparison: {
          previousPeriod: prev.period,
          callsDiffPct: callsDiff,
          directionRequestsDiffPct: routesDiff,
          websiteClicksDiffPct: websiteDiff,
          searchImpressionsDiffPct: searchDiff,
          mapsImpressionsDiffPct: mapsDiff,
          reviewsDiff: reviewsDiff
        }
      };
    });

    // Reverter para apresentar do mais recente ao mais antigo na UI
    reportsWithComparison.reverse();

    return res.json({
      success: true,
      reports: reportsWithComparison,
      totalMonths: reports.length
    });
  } catch (error: any) {
    console.error("[ClientPortal comparison]", error);
    return res.status(500).json({ error: "Erro ao gerar comparativo mensal." });
  }
});

// ----------------------------------------------------
// 8. CRUD DE CONTRATOS (AGÊNCIA)
// ----------------------------------------------------
clientPortalRoutes.get("/contracts", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });

    const adminDb = getAdminDb();
    const snap = await adminDb.collection(`salons/${salonId}/contracts`).get();
    const contracts: any[] = [];
    snap.forEach(doc => contracts.push({ id: doc.id, ...doc.data() }));
    contracts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return res.json({ contracts });
  } catch (error: any) {
    console.error("[ClientPortal get-contracts]", error);
    return res.status(500).json({ error: "Erro ao obter contratos." });
  }
});

clientPortalRoutes.post("/contracts", async (req, res) => {
  try {
    const { salonId, user } = await getAuthenticatedUserAndSalon(req);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });

    const {
      title,
      clientId,
      clientName,
      clientEmail,
      contractType,
      monthlyValue,
      startDate,
      endDate,
      status,
      scope,
      signedDocumentUrl,
      paymentTerms
    } = req.body || {};

    if (!title) {
      return res.status(400).json({ error: "Título do contrato é obrigatório." });
    }

    const adminDb = getAdminDb();
    const contractRef = adminDb.collection(`salons/${salonId}/contracts`).doc();
    const now = Date.now();

    const contractData = {
      id: contractRef.id,
      salonId,
      clientId: clientId || null,
      clientName: clientName || "Geral",
      clientEmail: clientEmail || "",
      title: title.trim(),
      contractType: contractType || "retainer_monthly",
      monthlyValue: Number(monthlyValue || 0),
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: endDate || "Indeterminado (Recorrente)",
      status: status || "active",
      scope: scope || "",
      signedDocumentUrl: signedDocumentUrl || "",
      paymentTerms: paymentTerms || "Mensal via Pix / Boleto",
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now
    };

    await contractRef.set(contractData);
    return res.json({ success: true, contract: contractData });
  } catch (error: any) {
    console.error("[ClientPortal create-contract]", error);
    return res.status(500).json({ error: "Erro ao salvar contrato." });
  }
});

clientPortalRoutes.put("/contracts/:id", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    const { id } = req.params;
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });

    const adminDb = getAdminDb();
    const contractRef = adminDb.collection(`salons/${salonId}/contracts`).doc(id);
    const snap = await contractRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Contrato não encontrado." });

    const updatePayload: any = {
      ...req.body,
      updatedAt: Date.now()
    };
    delete updatePayload.id;
    delete updatePayload.salonId;

    await contractRef.update(updatePayload);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[ClientPortal update-contract]", error);
    return res.status(500).json({ error: "Erro ao atualizar contrato." });
  }
});

clientPortalRoutes.delete("/contracts/:id", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    const { id } = req.params;
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });

    const adminDb = getAdminDb();
    await adminDb.collection(`salons/${salonId}/contracts`).doc(id).delete();
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[ClientPortal delete-contract]", error);
    return res.status(500).json({ error: "Erro ao excluir contrato." });
  }
});

// ----------------------------------------------------
// 9. SEED DE DEMONSTRAÇÃO PARA AGÊNCIA DE MARKETING (galicioriefonseca31@gmail.com)
// ----------------------------------------------------
clientPortalRoutes.post("/seed-agency-demo", async (req, res) => {
  try {
    const { salonId, user } = await getAuthenticatedUserAndSalon(req);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });

    const adminDb = getAdminDb();
    const now = Date.now();

    // 1. Atualizar salon para segmento de agência
    await adminDb.collection("salons").doc(salonId).set({
      businessType: "agency",
      segment: "agency",
      enabledModules: {
        clientPortal: true,
        appointments: true,
        clients: true,
        financial: true,
        services: true,
        team: true,
        checklists: true,
        goals: true,
        commissions: true,
        pricing: true
      },
      updatedAt: now
    }, { merge: true });

    // 2. Criar 2 clientes de exemplo com CRM completo
    const client1Ref = adminDb.collection(`salons/${salonId}/clients`).doc("demo_cli_acme");
    await client1Ref.set({
      id: "demo_cli_acme",
      name: "Acme Odontologia Integrada",
      contactName: "Dra. Carolina Mendes",
      email: "contato@acmeodonto.com.br",
      phone: "(11) 98765-4321",
      crmStage: "active",
      source: "instagram",
      sourceLabel: "Campanhas Meta Ads",
      portalAccessEnabled: true,
      tags: ["Tráfego Pago", "Fee Mensal", "Google Meu Negócio"],
      createdAt: now - 30 * 86400000,
      updatedAt: now
    }, { merge: true });

    const client2Ref = adminDb.collection(`salons/${salonId}/clients`).doc("demo_cli_lumina");
    await client2Ref.set({
      id: "demo_cli_lumina",
      name: "Lumina Estética Avançada",
      contactName: "Dra. Renata Vasconcelos",
      email: "diretoria@luminaestetica.com.br",
      phone: "(11) 99123-8899",
      crmStage: "active",
      source: "google",
      sourceLabel: "SEO & Google Ads",
      portalAccessEnabled: true,
      tags: ["Social Media", "Landing Page", "Performance"],
      createdAt: now - 45 * 86400000,
      updatedAt: now
    }, { merge: true });

    // 3. Criar relatórios de exemplo
    const rep1Ref = adminDb.collection(`salons/${salonId}/reports`).doc("demo_rep_out_acme");
    await rep1Ref.set({
      id: "demo_rep_out_acme",
      salonId,
      clientId: "demo_cli_acme",
      clientName: "Acme Odontologia Integrada",
      clientEmail: "contato@acmeodonto.com.br",
      title: "Desempenho Google Meu Negócio & Campanhas Meta Ads - Outubro/2026",
      period: "Outubro / 2026",
      summary: "Excelente mês de tração! A ficha no Google Maps alcançou o Top 2 local com 218 rotas traçadas e 94 ligações telefônicas diretas. Campanhas focadas em implantes e Invisalign geraram 148 leads qualificados.",
      reportType: "google_meu_negocio",
      metrics: {
        leads: 148,
        reach: 84200,
        conversions: 36,
        investment: 4200,
        revenue: 29800,
        roas: 7.1,
        cpc: 1.15,
        cpl: 28.37
      },
      gmbMetrics: {
        directionRequests: 218,
        calls: 94,
        websiteClicks: 165,
        mapsImpressions: 14200,
        searchImpressions: 8900,
        rankingPosition: 2,
        targetKeyword: "Dentista Invisalign & Implantes",
        topKeywords: [
          { keyword: "dentista perto de mim", count: 312 },
          { keyword: "implante dentario preco", count: 184 },
          { keyword: "clinica odontologica centro", count: 142 },
          { keyword: "invisalign parcelado", count: 96 }
        ],
        rating: 4.9,
        reviewsCount: 88
      },
      externalUrl: "https://lookerstudio.google.com",
      status: "published",
      publishedAt: now,
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now
    }, { merge: true });

    const rep2Ref = adminDb.collection(`salons/${salonId}/reports`).doc("demo_rep_out_lumina");
    await rep2Ref.set({
      id: "demo_rep_out_lumina",
      salonId,
      clientId: "demo_cli_lumina",
      clientName: "Lumina Estética Avançada",
      clientEmail: "diretoria@luminaestetica.com.br",
      title: "Relatório de Ranqueamento no Google Maps & Tráfego Local",
      period: "Outubro / 2026",
      summary: "A Lumina conquistou o 1º Lugar no ranking do Google Maps para 'Clínica de Estética & Botox Facial' na região. 185 rotas no Waze/Maps e 76 ligações diretas geradas organicamente.",
      reportType: "google_meu_negocio",
      metrics: {
        leads: 92,
        reach: 125000,
        conversions: 41,
        investment: 3100,
        revenue: 18400,
        roas: 5.9,
        cpc: 0.88,
        cpl: 33.69
      },
      gmbMetrics: {
        directionRequests: 185,
        calls: 76,
        websiteClicks: 142,
        mapsImpressions: 19800,
        searchImpressions: 12400,
        rankingPosition: 1,
        targetKeyword: "Clínica de Estética & Botox Facial",
        topKeywords: [
          { keyword: "clinica de estetica facial", count: 420 },
          { keyword: "botox valor da aplicacao", count: 295 },
          { keyword: "harmonizacao orofacial", count: 180 },
          { keyword: "drenagem linfatica corporal", count: 115 }
        ],
        rating: 5.0,
        reviewsCount: 104
      },
      externalUrl: "https://lookerstudio.google.com",
      status: "published",
      publishedAt: now,
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now
    }, { merge: true });

    // 4. Criar contratos de exemplo
    const cont1Ref = adminDb.collection(`salons/${salonId}/contracts`).doc("demo_cont_acme");
    await cont1Ref.set({
      id: "demo_cont_acme",
      salonId,
      clientId: "demo_cli_acme",
      clientName: "Acme Odontologia Integrada",
      clientEmail: "contato@acmeodonto.com.br",
      title: "Contrato de Prestação de Serviços de Marketing Digital & Gestão de Tráfego",
      contractType: "retainer_monthly",
      monthlyValue: 3500,
      startDate: "2026-01-10",
      endDate: "12 meses (Renovação Automática)",
      status: "active",
      scope: "Gestão completa de campanhas Meta Ads e Google Ads, criação de 8 criativos mensais, otimização contínua de Google Meu Negócio e reunião quinzenal de alinhamento estratégico.",
      signedDocumentUrl: "https://drive.google.com",
      paymentTerms: "Vencimento dia 10 de cada mês via Pix",
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now
    }, { merge: true });

    const cont2Ref = adminDb.collection(`salons/${salonId}/contracts`).doc("demo_cont_lumina");
    await cont2Ref.set({
      id: "demo_cont_lumina",
      salonId,
      clientId: "demo_cli_lumina",
      clientName: "Lumina Estética Avançada",
      clientEmail: "diretoria@luminaestetica.com.br",
      title: "Contrato de Social Media, Branding e Aquisição de Clientes",
      contractType: "retainer_monthly",
      monthlyValue: 2800,
      startDate: "2026-03-01",
      endDate: "Indeterminado",
      status: "active",
      scope: "Produção de 12 posts/carrosséis no feed, 16 roteiros para Reels, monitoramento de mensagens e gestão de anúncios para captação de novos procedimentos estéticos.",
      signedDocumentUrl: "https://drive.google.com",
      paymentTerms: "Vencimento dia 05 de cada mês via Boleto/Pix",
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now
    }, { merge: true });

    // 5. Criar convite de demonstração pronto
    const inviteToken = "cli_demo_convite_acme";
    await adminDb.collection("invites").doc(inviteToken).set({
      inviteId: inviteToken,
      token: inviteToken,
      salonId,
      agencyName: "GF Marketing Digital",
      inviteType: "client",
      role: "client",
      clientName: "Dra. Carolina Mendes",
      companyName: "Acme Odontologia Integrada",
      clientEmail: "contato@acmeodonto.com.br",
      clientPhone: "(11) 98765-4321",
      clientId: "demo_cli_acme",
      status: "pending",
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + 30 * 86400000
    }, { merge: true });

    // 6. Criar aprovações de demonstração
    const appr1Ref = adminDb.collection(`salons/${salonId}/approvals`).doc("demo_appr_gmn");
    await appr1Ref.set({
      id: "demo_appr_gmn",
      salonId,
      clientId: "demo_cli_acme",
      clientName: "Acme Odontologia Integrada",
      title: "Publicação no Google Meu Negócio: Clareamento a Laser & Condições de Fim de Ano",
      type: "gmn_post",
      copyText: "✨ Sorriso renovado para o fim de ano! Agende sua avaliação de clareamento a laser na Acme Odonto com condições facilitadas. Vagas limitadas no perfil oficial do Google!",
      mediaUrl: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=800&q=80",
      status: "pending",
      createdBy: user.uid,
      createdAt: now - 86400000,
      updatedAt: now - 86400000
    }, { merge: true });

    const appr2Ref = adminDb.collection(`salons/${salonId}/approvals`).doc("demo_appr_insta");
    await appr2Ref.set({
      id: "demo_appr_insta",
      salonId,
      clientId: "demo_cli_acme",
      clientName: "Acme Odontologia Integrada",
      title: "Carrossel Instagram: 5 Mitos sobre Alinhadores Invisíveis",
      type: "instagram_post",
      copyText: "Você sabia que os alinhadores transparentes tratam o sorriso sem fios de metal e sem restrições alimentares? Arraste para o lado e confira os 5 principais mitos desvendados. Agende no link da bio!",
      mediaUrl: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80",
      status: "approved",
      approvedAt: now - 3600000,
      createdBy: user.uid,
      createdAt: now - 2 * 86400000,
      updatedAt: now - 3600000
    }, { merge: true });

    const appr3Ref = adminDb.collection(`salons/${salonId}/approvals`).doc("demo_appr_landing");
    await appr3Ref.set({
      id: "demo_appr_landing",
      salonId,
      clientId: "demo_cli_acme",
      clientName: "Acme Odontologia Integrada",
      title: "Nova Seção de Depoimentos & Botão WhatsApp Flutuante na Landing Page",
      type: "landing_page",
      previewUrl: "https://acmeodonto.com.br/implantes",
      copyText: "Estrutura completa com copywriting focado em conversão de pacientes particulares, carregamento ultra-rápido no celular e rastreamento de cliques no WhatsApp configurado.",
      mediaUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
      status: "pending",
      createdBy: user.uid,
      createdAt: now - 12000000,
      updatedAt: now - 12000000
    }, { merge: true });

    // 7. Criar cronograma de entregáveis de demonstração
    const deliv1Ref = adminDb.collection(`salons/${salonId}/deliverables`).doc("demo_deliv_gmn");
    await deliv1Ref.set({
      id: "demo_deliv_gmn",
      salonId,
      clientId: "demo_cli_acme",
      clientName: "Acme Odontologia Integrada",
      title: "Otimização semanal de fotos e palavras-chave locais no Google Meu Negócio",
      category: "google_meu_negocio",
      dueDate: new Date(now + 3 * 86400000).toISOString().slice(0, 10),
      status: "pending",
      notes: "Atualização de atributos de atendimento, catálogo de procedimentos e post semanal de novidades.",
      createdAt: now
    }, { merge: true });

    const deliv2Ref = adminDb.collection(`salons/${salonId}/deliverables`).doc("demo_deliv_insta");
    await deliv2Ref.set({
      id: "demo_deliv_insta",
      salonId,
      clientId: "demo_cli_acme",
      clientName: "Acme Odontologia Integrada",
      title: "Disparo de 3 Reels com roteiro de retenção e edição dinâmica para Instagram",
      category: "instagram",
      dueDate: new Date(now + 6 * 86400000).toISOString().slice(0, 10),
      status: "in_progress",
      notes: "Temas: mitos de clareamento, bastidores do consultório e passo a passo dos alinhadores.",
      createdAt: now
    }, { merge: true });

    const deliv3Ref = adminDb.collection(`salons/${salonId}/deliverables`).doc("demo_deliv_site");
    await deliv3Ref.set({
      id: "demo_deliv_site",
      salonId,
      clientId: "demo_cli_acme",
      clientName: "Acme Odontologia Integrada",
      title: "Publicação e testes de conversão da Landing Page de Implantes",
      category: "site_landing_page",
      dueDate: new Date(now - 1 * 86400000).toISOString().slice(0, 10),
      status: "completed",
      completedAt: now - 86400000,
      deliverableUrl: "https://acmeodonto.com.br/implantes",
      notes: "Subida em ambiente de produção com SSL ativo e meta-pixel verificado.",
      createdAt: now - 3 * 86400000
    }, { merge: true });

    // 8. Criar tickets de suporte de demonstração
    const ticket1Ref = adminDb.collection(`salons/${salonId}/tickets`).doc("demo_ticket_1");
    await ticket1Ref.set({
      id: "demo_ticket_1",
      salonId,
      clientId: "demo_cli_acme",
      clientName: "Dra. Carolina Mendes",
      clientEmail: "contato@acmeodonto.com.br",
      subject: "Ajuste no horário de atendimento do feriado no Google Meu Negócio",
      category: "google_meu_negocio",
      priority: "media",
      status: "in_progress",
      messages: [
        {
          id: "msg_1",
          senderRole: "client",
          senderName: "Dra. Carolina Mendes",
          text: "Olá equipe da agência! Gostaria de confirmar se no próximo feriado de sexta-feira nosso perfil no Google estará marcado com aviso de horário especial.",
          createdAt: now - 18000000
        },
        {
          id: "msg_2",
          senderRole: "agency",
          senderName: "Gestor de Contas",
          text: "Olá Dra. Carolina! Perfeito, já atualizamos os horários especiais de feriado no painel do Google Meu Negócio sem afetar seu ranqueamento local.",
          createdAt: now - 9000000
        }
      ],
      createdAt: now - 18000000,
      updatedAt: now - 9000000
    }, { merge: true });

    return res.json({
      success: true,
      message: "Ambiente completo de Agência de Marketing inicializado com sucesso!",
      inviteToken
    });
  } catch (error: any) {
    console.error("[ClientPortal seed-agency-demo]", error);
    return res.status(500).json({ error: "Erro ao gerar dados de demonstração." });
  }
});

// ----------------------------------------------------
// 10. APROVAÇÕES (Fluxo de Trabalho)
// ----------------------------------------------------
clientPortalRoutes.get("/approvals", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });
    const adminDb = getAdminDb();
    const snap = await adminDb.collection(`salons/${salonId}/approvals`).get();
    const data: any[] = [];
    snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
    data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return res.json({ data });
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao buscar aprovações." });
  }
});

clientPortalRoutes.post("/approvals", async (req, res) => {
  try {
    const { salonId, user } = await getAuthenticatedUserAndSalon(req);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });
    
    const adminDb = getAdminDb();
    const ref = adminDb.collection(`salons/${salonId}/approvals`).doc();
    const now = Date.now();
    const payload = {
      id: ref.id,
      salonId,
      ...req.body,
      status: req.body?.status || 'pending',
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now
    };
    await ref.set(payload);
    return res.json({ success: true, data: payload });
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao criar aprovação." });
  }
});

clientPortalRoutes.patch("/approvals/:id/review", async (req, res) => {
  try {
    const { salonId, user } = await getAuthenticatedUserAndSalon(req, false);
    const { id } = req.params;
    const { status, clientFeedback } = req.body || {};

    if (!['approved', 'revisions_requested'].includes(status)) {
      return res.status(400).json({ error: "Status de revisão inválido." });
    }

    const adminDb = getAdminDb();
    const ref = adminDb.collection(`salons/${salonId}/approvals`).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Item de aprovação não encontrado." });

    const now = Date.now();
    const updateData: any = {
      status,
      updatedAt: now
    };

    if (status === 'approved') {
      updateData.approvedAt = now;
      if (clientFeedback) updateData.clientFeedback = clientFeedback;
    } else {
      updateData.feedbackAt = now;
      updateData.clientFeedback = clientFeedback || "Alteração solicitada pelo cliente.";
    }

    await ref.update(updateData);
    return res.json({ success: true, data: { ...snap.data(), ...updateData } });
  } catch (error: any) {
    console.error("[ClientPortal review-approval]", error);
    return res.status(500).json({ error: "Erro ao registrar revisão de aprovação." });
  }
});

clientPortalRoutes.delete("/approvals/:id", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    const { id } = req.params;
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });
    const adminDb = getAdminDb();
    await adminDb.collection(`salons/${salonId}/approvals`).doc(id).delete();
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao excluir aprovação." });
  }
});

// ----------------------------------------------------
// 11. TICKETS DE SUPORTE
// ----------------------------------------------------
clientPortalRoutes.get("/tickets", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req, false);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });
    const adminDb = getAdminDb();
    const snap = await adminDb.collection(`salons/${salonId}/tickets`).get();
    const data: any[] = [];
    snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
    data.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    return res.json({ data });
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao buscar tickets." });
  }
});

clientPortalRoutes.post("/tickets", async (req, res) => {
  try {
    const { salonId, user, userData } = await getAuthenticatedUserAndSalon(req, false);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });
    
    const { subject, category, priority, initialMessage, clientId, clientName, clientEmail } = req.body || {};
    if (!subject) return res.status(400).json({ error: "Assunto do ticket é obrigatório." });

    const adminDb = getAdminDb();
    const ref = adminDb.collection(`salons/${salonId}/tickets`).doc();
    const now = Date.now();

    const isAgency = userData?.salonId === salonId && (userData?.role === 'admin' || userData?.role === 'owner');
    const senderRole = isAgency ? 'agency' : 'client';
    const senderName = req.body?.senderName || user.displayName || (senderRole === 'client' ? 'Cliente' : 'Agência');

    const messages = [];
    if (initialMessage && initialMessage.trim()) {
      messages.push({
        id: `msg_${now}`,
        senderRole,
        senderName,
        text: initialMessage.trim(),
        createdAt: now
      });
    }

    const payload = {
      id: ref.id,
      salonId,
      clientId: clientId || null,
      clientName: clientName || (senderRole === 'client' ? (user.displayName || "Cliente") : "Cliente"),
      clientEmail: clientEmail || user.email || "",
      subject: subject.trim(),
      category: category || 'geral',
      priority: priority || 'media',
      status: 'open',
      messages,
      createdAt: now,
      updatedAt: now
    };
    await ref.set(payload);
    return res.json({ success: true, data: payload });
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao criar ticket." });
  }
});

clientPortalRoutes.post("/tickets/:id/messages", async (req, res) => {
  try {
    const { salonId, user, userData } = await getAuthenticatedUserAndSalon(req, false);
    const { id } = req.params;
    const { text, senderName } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Mensagem não pode ser vazia." });
    }

    const adminDb = getAdminDb();
    const ref = adminDb.collection(`salons/${salonId}/tickets`).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Ticket não encontrado." });

    const ticketData = snap.data() || {};
    const now = Date.now();
    
    const isAgency = userData?.salonId === salonId && (userData?.role === 'admin' || userData?.role === 'owner');
    const senderRole = isAgency ? 'agency' : 'client';
    const finalSenderName = senderName || user.displayName || (senderRole === 'client' ? 'Cliente' : 'Equipe da Agência');

    const newMessage = {
      id: `msg_${now}`,
      senderRole,
      senderName: finalSenderName,
      text: text.trim(),
      createdAt: now
    };

    const updatedMessages = [...(ticketData.messages || []), newMessage];
    const updatePayload: any = {
      messages: updatedMessages,
      updatedAt: now
    };

    // Se o cliente responder e estiver fechado/resolvido, reabre para in_progress
    if (senderRole === 'client' && (ticketData.status === 'resolved' || ticketData.status === 'closed')) {
      updatePayload.status = 'in_progress';
    }

    await ref.update(updatePayload);
    return res.json({ success: true, message: newMessage, status: updatePayload.status || ticketData.status });
  } catch (error: any) {
    console.error("[ClientPortal add-ticket-message]", error);
    return res.status(500).json({ error: "Erro ao enviar mensagem." });
  }
});

clientPortalRoutes.patch("/tickets/:id/status", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    const { id } = req.params;
    const { status } = req.body || {};

    if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ error: "Status inválido." });
    }

    const adminDb = getAdminDb();
    const ref = adminDb.collection(`salons/${salonId}/tickets`).doc(id);
    await ref.update({ status, updatedAt: Date.now() });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao atualizar status do ticket." });
  }
});

// ----------------------------------------------------
// 12. ENTREGÁVEIS (CRONOGRAMA)
// ----------------------------------------------------
clientPortalRoutes.get("/deliverables", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });
    const adminDb = getAdminDb();
    const snap = await adminDb.collection(`salons/${salonId}/deliverables`).get();
    const data: any[] = [];
    snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
    data.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return res.json({ data });
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao buscar entregáveis." });
  }
});

clientPortalRoutes.post("/deliverables", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });
    
    const { title, dueDate, category, notes, deliverableUrl, clientId, clientName } = req.body || {};
    if (!title || !dueDate) {
      return res.status(400).json({ error: "Título e data de entrega são obrigatórios." });
    }

    const adminDb = getAdminDb();
    const ref = adminDb.collection(`salons/${salonId}/deliverables`).doc();
    const now = Date.now();
    const payload = {
      id: ref.id,
      salonId,
      clientId: clientId || null,
      clientName: clientName || "Geral",
      title: title.trim(),
      dueDate,
      category: category || "geral",
      status: "pending",
      notes: notes || "",
      deliverableUrl: deliverableUrl || "",
      createdAt: now
    };
    await ref.set(payload);
    return res.json({ success: true, data: payload });
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao criar entregável." });
  }
});

clientPortalRoutes.patch("/deliverables/:id/status", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    const { id } = req.params;
    const { status } = req.body || {};

    if (!['pending', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: "Status inválido." });
    }

    const adminDb = getAdminDb();
    const ref = adminDb.collection(`salons/${salonId}/deliverables`).doc(id);
    const updateData: any = { status };
    if (status === 'completed') {
      updateData.completedAt = Date.now();
    }
    await ref.update(updateData);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao atualizar entregável." });
  }
});

clientPortalRoutes.delete("/deliverables/:id", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    const { id } = req.params;
    const adminDb = getAdminDb();
    await adminDb.collection(`salons/${salonId}/deliverables`).doc(id).delete();
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao excluir entregável." });
  }
});

// ----------------------------------------------------
// 13. PEDIDOS DE SERVIÇOS EXTRAS (UP-SELL)
// ----------------------------------------------------
clientPortalRoutes.get("/service-requests", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });
    const adminDb = getAdminDb();
    const snap = await adminDb.collection(`salons/${salonId}/serviceRequests`).get();
    const data: any[] = [];
    snap.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
    data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return res.json({ data });
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao buscar pedidos de serviços." });
  }
});

clientPortalRoutes.post("/service-requests", async (req, res) => {
  try {
    const { salonId, user } = await getAuthenticatedUserAndSalon(req, false);
    if (!salonId) return res.status(403).json({ error: "Agência não identificada." });
    
    const { serviceId, serviceName, category, notes, clientName, clientEmail, clientPhone, clientId } = req.body || {};
    if (!serviceName) return res.status(400).json({ error: "Nome do serviço é obrigatório." });

    const adminDb = getAdminDb();
    const ref = adminDb.collection(`salons/${salonId}/serviceRequests`).doc();
    const now = Date.now();
    const payload = {
      id: ref.id,
      salonId,
      clientId: clientId || user.uid,
      clientName: clientName || user.displayName || "Cliente",
      clientEmail: clientEmail || user.email || "",
      clientPhone: clientPhone || "",
      serviceId: serviceId || "custom",
      serviceName,
      category: category || "geral",
      notes: notes || "",
      status: 'requested',
      createdAt: now,
      updatedAt: now
    };
    await ref.set(payload);
    return res.json({ success: true, data: payload });
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao criar pedido de serviço." });
  }
});

clientPortalRoutes.patch("/service-requests/:id/status", async (req, res) => {
  try {
    const { salonId } = await getAuthenticatedUserAndSalon(req);
    const { id } = req.params;
    const { status } = req.body || {};

    if (!['requested', 'in_review', 'quoted', 'accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: "Status inválido." });
    }

    const adminDb = getAdminDb();
    await adminDb.collection(`salons/${salonId}/serviceRequests`).doc(id).update({
      status,
      updatedAt: Date.now()
    });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: "Erro ao atualizar pedido de serviço." });
  }
});

