import { Router } from "express";
import { getAdminDb, getAdminMessaging } from "../firebaseAdmin.js";
import { adminLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post("/send-appointment-push", adminLimiter, async (req, res) => {
  try {
    const { salonId, appointmentId, professionalId, clientName, serviceName, date, time, action } = req.body;
    
    if (!salonId || !professionalId) {
      return res.status(400).json({ error: "salonId e professionalId são obrigatórios." });
    }

    console.log(`[Push Notification Backend] Enviando alerta para o profissional ${professionalId} no salão ${salonId}...`);

    const adminDb = getAdminDb();
    let uniqueTokens: string[] = [];

    // 1. Procurar tokens FCM no cadastro do profissional do salão
    try {
      const proDocRef = adminDb.collection("salons").doc(salonId).collection("professionals").doc(professionalId);
      const proDoc = await proDocRef.get();
      if (proDoc.exists) {
        const data = proDoc.data();
        if (data?.fcmToken) uniqueTokens.push(data.fcmToken);
        if (Array.isArray(data?.fcmTokens)) {
          uniqueTokens = [...uniqueTokens, ...data.fcmTokens];
        }
      }
    } catch (err) {
      console.warn("[Push Notification Backend] Falha ao ler documento do profissional do salão:", err);
    }

    // 2. Procurar tokens FCM no cadastro global '/users'
    try {
      const userDocRef = adminDb.collection("users").doc(professionalId);
      const userDoc = await userDocRef.get();
      if (userDoc.exists) {
        const data = userDoc.data();
        if (data?.fcmToken) uniqueTokens.push(data.fcmToken);
        if (Array.isArray(data?.fcmTokens)) {
          uniqueTokens = [...uniqueTokens, ...data.fcmTokens];
        }
      }
    } catch (err) {
      console.warn("[Push Notification Backend] Falha ao ler documento global do usuário:", err);
    }

    // Filtrar e desduplicar tokens nulos ou vazios
    const activeTokens = Array.from(new Set(uniqueTokens.filter(t => typeof t === "string" && t.trim().length > 0)));

    if (activeTokens.length === 0) {
      console.log(`[Push Notification Backend] Nenhum token registrado para o profissional ${professionalId}.`);
      return res.json({ success: false, reason: "no_registered_tokens_found" });
    }

    console.log(`[Push Notification Backend] Disparando para ${activeTokens.length} tokens ativos...`);

    const title = action === "cancel" 
      ? "Agendamento Cancelado 🛑" 
      : "Novo Agendamento Confirmado! 📅";
    
    const body = action === "cancel"
      ? `${clientName || "Cliente"} cancelou o serviço de ${serviceName || "Atendimento"} do dia ${date || ""} às ${time || ""}.`
      : `${clientName || "Cliente"} agendou ${serviceName || "Atendimento"} para o dia ${date || ""} às ${time || ""}.`;

    const payload = {
      title,
      body,
    };

    const messaging = getAdminMessaging();

    // Envia notificação por token de forma concorrente e resiliente
    const sendPromises = activeTokens.map((token) => 
      messaging.send({
        token,
        notification: payload,
        data: {
          appointmentId: appointmentId || "",
          click_action: "/dashboard?tab=agenda",
        },
        webpush: {
          notification: {
            badge: "/icons/icon-192x192.png",
            icon: "/icons/icon-192x192.png",
          }
        }
      }).catch((err: any) => {
        console.warn(`[Push Notification Backend] Falha ao disparar para um token:`, err);
        return null;
      })
    );

    await Promise.all(sendPromises);

    return res.json({ success: true, tokensNotifiedCount: activeTokens.length });
  } catch (error: any) {
    console.error("[Push Notification Backend] Erro crítico ao processar push notification:", error);
    return res.status(500).json({ error: error?.message || "Erro crítico no servidor de push" });
  }
});

export { router as pushRoutes };
