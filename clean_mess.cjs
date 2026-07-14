const fs = require('fs');

function cleanServer() {
    let code = fs.readFileSync('server/index.ts', 'utf-8');
    const startStr = 'if (salonData.pendingOfferId && offerId && salonData.pendingOfferId !== offerId) {';
    const endStr = 'updatePayload.subscriptionStatus = "active";';
    
    const startIdx = code.indexOf(startStr);
    const endIdx = code.indexOf(endStr, startIdx);
    
    if (startIdx !== -1 && endIdx !== -1) {
        const replacement = `if (salonData.pendingOfferId && offerId && salonData.pendingOfferId !== offerId) {
          console.error(\`[Cakto Webhook Helper] ALERTA DE SEGURANÇA: Oferta divergente detectada para o salão \${salonId}. Esperada: \${salonData.pendingOfferId}, Recebida: \${offerId}.\`);
          
          const historyRef = adminDb.collection("salons").doc(salonId).collection("billingHistory").doc();
          await historyRef.set({
            id: historyRef.id,
            eventType: "webhook_offer_mismatch",
            title: "Divergência de Oferta Bloqueada",
            description: \`A assinatura Cakto foi rejeitada por divergência de oferta (Esperada: \${salonData.pendingOfferId}, Recebida: \${offerId}).\`,
            timestamp: Date.now(),
            recordedBy: "system"
          });

          return { status: 200, data: { success: false, requiresReview: true, reason: "offer_mismatch" } };
        }
      }
      `;
      code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
      fs.writeFileSync('server/index.ts', code);
      console.log('Cleaned server/index.ts');
    }
}

function cleanWebhook() {
    let code = fs.readFileSync('api/cakto/webhook.ts', 'utf-8');
    const startStr = 'if (data?.pendingOfferId && offerId && data.pendingOfferId !== offerId) {';
    const endStr = 'if (isSimulation) {';
    
    const startIdx = code.indexOf(startStr);
    const endIdx = code.indexOf(endStr, startIdx);
    
    if (startIdx !== -1 && endIdx !== -1) {
        const replacement = `if (data?.pendingOfferId && offerId && data.pendingOfferId !== offerId) {
        console.error(\`[Cakto Webhook] ALERTA DE SEGURANÇA: Oferta divergente detectada para o salão \${salonDoc.id}. Esperada: \${data.pendingOfferId}, Recebida: \${offerId}.\`);
        
        const historyRef = adminDb.collection("salons").doc(salonDoc.id).collection("billingHistory").doc();
        await historyRef.set({
          id: historyRef.id,
          eventType: "webhook_offer_mismatch",
          title: "Divergência de Oferta Bloqueada",
          description: \`A assinatura Cakto foi rejeitada por divergência de oferta (Esperada: \${data.pendingOfferId}, Recebida: \${offerId}).\`,
          timestamp: Date.now(),
          recordedBy: "system"
        });

        return res.status(200).json({ success: false, requiresReview: true, reason: "offer_mismatch" });
      }
    }
    
    `;
      code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
      fs.writeFileSync('api/cakto/webhook.ts', code);
      console.log('Cleaned api/cakto/webhook.ts');
    }
}

cleanServer();
cleanWebhook();
