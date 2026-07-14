const fs = require('fs');

function patchWebhook(filename, isServer) {
    let code = fs.readFileSync(filename, 'utf-8');
    const targetStart = 'if (!isSimulation && salonDoc?.exists) {';
    const serverTargetStart = 'if (!skipTokenValidation && salonDoc?.exists) {';
    const targetToUse = isServer ? serverTargetStart : targetStart;
    
    // Find where the block ends
    const endStr = '      }';
    
    const blockStart = code.indexOf(targetToUse);
    if (blockStart === -1) {
        console.log(`Could not find target block in ${filename}`);
        return;
    }
    
    // Replace the inner part of offer mismatch
    const mismatchStart = code.indexOf('if (data?.pendingOfferId && offerId && data.pendingOfferId !== offerId) {', blockStart);
    if (mismatchStart === -1) {
        console.log(`Could not find mismatch if in ${filename}`);
        return;
    }
    
    const mismatchEnd = code.indexOf('}', mismatchStart);
    
    const returnStatement = isServer 
        ? 'return { status: 200, data: { success: false, requiresReview: true, reason: "offer_mismatch" } };'
        : 'return res.status(200).json({ success: false, requiresReview: true, reason: "offer_mismatch" });';
        
    const salonIdVar = isServer ? 'salonId' : 'salonDoc.id';

    const newMismatchBlock = `if (data?.pendingOfferId && offerId && data.pendingOfferId !== offerId) {
        console.error(\`[Cakto Webhook] ALERTA DE SEGURANÇA: Oferta divergente detectada para o salão \${${salonIdVar}}. Esperada: \${data.pendingOfferId}, Recebida: \${offerId}.\`);
        
        const historyRef = adminDb.collection("salons").doc(${salonIdVar}).collection("billingHistory").doc();
        await historyRef.set({
          id: historyRef.id,
          eventType: "webhook_offer_mismatch",
          title: "Divergência de Oferta Bloqueada",
          description: \`A assinatura Cakto foi rejeitada por divergência de oferta (Esperada: \${data.pendingOfferId}, Recebida: \${offerId}).\`,
          timestamp: Date.now(),
          recordedBy: "system"
        });

        ${returnStatement}
      `;
      
    code = code.substring(0, mismatchStart) + newMismatchBlock + code.substring(mismatchEnd);
    fs.writeFileSync(filename, code);
    console.log(`Patched interception in ${filename}`);
}

patchWebhook('api/cakto/webhook.ts', false);
patchWebhook('server/index.ts', true);
