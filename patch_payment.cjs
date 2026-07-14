const fs = require('fs');

function patchPaymentMethod(filename, isServer) {
    if (!fs.existsSync(filename)) return;
    
    let code = fs.readFileSync(filename, 'utf-8');
    
    const patchStart = code.indexOf('// Atualizar método na API Cakto se for Pix/Boleto ou Pix Automático');
    if (patchStart === -1) {
        console.log('Patch start not found in ' + filename);
        return;
    }
    
    const patchEndStr = '} else {';
    const patchEnd = code.indexOf(patchEndStr, patchStart);
    
    if (patchEnd === -1) {
         console.log('Patch end not found in ' + filename);
         return;
    }
    
    const replacement = `// Atualizar método na API Cakto se for Pix/Boleto ou Pix Automático
      // REGRA: PATCH da Cakto suspenso e convertido em configuração assistida, sem endpoint oficial na API
      const responseJson = isServer ? { status: 200, data: {
          success: false,
          requiresSupport: true,
          message: "A solicitação foi registrada. Esta forma de pagamento requer configuração assistida pela nossa equipe financeira para ser concluída (API Cakto pendente de endpoint oficial para troca autônoma)."
        } } : {
          success: false,
          requiresSupport: true,
          message: "A solicitação foi registrada. Esta forma de pagamento requer configuração assistida pela nossa equipe financeira para ser concluída (API Cakto pendente de endpoint oficial para troca autônoma)."
        };
        
      if (isServer) {
        return responseJson;
      } else {
        return res.status(200).json(responseJson);
      }
    `;
    
    const newCode = code.substring(0, patchStart) + replacement.replace(/isServer/g, isServer ? 'true' : 'false') + code.substring(patchEnd);
    fs.writeFileSync(filename, newCode);
    console.log('Patched payment method in ' + filename);
}

patchPaymentMethod('api/cakto/update-payment-method.ts', false);
patchPaymentMethod('server/index.ts', true);
