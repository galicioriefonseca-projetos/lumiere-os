const fs = require('fs');

let code = fs.readFileSync('server/index.ts', 'utf-8');
const target = 'if (!skipTokenValidation && salonData) {';

const blockStart = code.indexOf(target);
if (blockStart !== -1) {
    const mismatchStart = code.indexOf('if (salonData.pendingOfferId && offerId && salonData.pendingOfferId !== offerId) {', blockStart);
    const mismatchEnd = code.indexOf('}', mismatchStart);
    
    const newMismatchBlock = `if (salonData.pendingOfferId && offerId && salonData.pendingOfferId !== offerId) {
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
        `;
        
    code = code.substring(0, mismatchStart) + newMismatchBlock + code.substring(mismatchEnd);
    fs.writeFileSync('server/index.ts', code);
    console.log('Patched server/index.ts');
}
