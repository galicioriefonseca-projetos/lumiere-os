const fs = require('fs');

function restoreAndPatchWebhook() {
    let code = fs.readFileSync('api/cakto/webhook.ts', 'utf-8');
    
    // Check if it's messed up
    const messedStr = '}. Esperada: ${data.pendingOfferId}, Recebida: ${offerId}. Auditoria necessária.`)';
    const regexStr = /if \(data\?\.pendingOfferId && offerId && data\.pendingOfferId !== offerId\) \{[\s\S]*?\} \};[\s]*\}\. Esperada:[^\}]*\}\n[\s]*\}/;
    
    // Let's just do a clean replace using regex since we know exactly what is there
    // The messed up part starts at `if (data?.pendingOfferId && offerId && data.pendingOfferId !== offerId) {`
    // and ends at the closing `}` of the original if block.
    // The original block ended after `updatePayload.auditReceivedOffer = offerId; \n }`
    
    // Instead of parsing, I will just restore from webhook-restored.ts which I still have? 
    // Wait, I used `mv webhook-restored.ts webhook.ts` so I don't have it anymore!
    // But I can run `restore.cjs` again!
}
restoreAndPatchWebhook();
