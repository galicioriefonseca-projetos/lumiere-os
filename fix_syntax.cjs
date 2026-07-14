const fs = require('fs');

function fix(filename, isServer) {
    let code = fs.readFileSync(filename, 'utf-8');
    
    const startStr = '// Atualizar método na API Cakto se for Pix/Boleto ou Pix Automático';
    const endStr = '    } else {';
    
    // In the original file, it was:
    /*
      // Atualizar método na API Cakto se for Pix/Boleto ou Pix Automático
      ...
      } catch (apiErr) {
        ...
      }
    } else {
      // Se for homologação e Platform Admin, tratamos as validações de simulação locais
    */
    
    // In our corrupted file, we have:
    /*
      // Atualizar método na API Cakto se for Pix/Boleto ou Pix Automático
      // REGRA: PATCH ...
      return res.status(200).json({...});
    } else {
        return res.status(200).json(responseJson);
      }
    } else {
      // Se for homologação e Platform Admin
    */
    
    const startIdx = code.indexOf(startStr);
    const endIdx = code.indexOf('// Se for homologação e Platform Admin', startIdx);
    
    if (startIdx !== -1 && endIdx !== -1) {
        // the end string is "} else {\n      // Se for homologação"
        const actualEnd = code.lastIndexOf('} else {', endIdx);
        
        const returnStr = isServer 
            ? 'return res.status(200).json({ success: false, requiresSupport: true, message: "A solicitação foi registrada. Esta forma de pagamento requer configuração assistida pela nossa equipe financeira para ser concluída (API Cakto pendente de endpoint oficial para troca autônoma)." });'
            : 'return res.status(200).json({ success: false, requiresSupport: true, message: "A solicitação foi registrada. Esta forma de pagamento requer configuração assistida pela nossa equipe financeira para ser concluída (API Cakto pendente de endpoint oficial para troca autônoma)." });';
            
        const replacement = `// Atualizar método na API Cakto se for Pix/Boleto ou Pix Automático
      // REGRA: PATCH da Cakto suspenso e convertido em configuração assistida, sem endpoint oficial na API
      ${returnStr}
    `;
        code = code.substring(0, startIdx) + replacement + code.substring(actualEnd);
        fs.writeFileSync(filename, code);
        console.log('Fixed syntax in ' + filename);
    }
}
fix('api/cakto/update-payment-method.ts', false);
fix('server/index.ts', true);
