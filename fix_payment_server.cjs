const fs = require('fs');

let code = fs.readFileSync('server/index.ts', 'utf-8');
const target = `const responseJson = true ? { status: 200, data: {`;
const replaceTarget = `if (true) {
        return responseJson;
      } else {
        return res.status(200).json(responseJson);
      }`;

const targetIdx = code.indexOf(target);
if (targetIdx !== -1) {
    // Just replace the whole injected block with a clean res.status(200).json
    
    const blockStart = code.indexOf('// REGRA: PATCH da Cakto suspenso');
    const blockEnd = code.indexOf('} else {', blockStart); // wait, it's just before '} else {'
    const replacement = `// REGRA: PATCH da Cakto suspenso e convertido em configuração assistida, sem endpoint oficial na API
      return res.status(200).json({
        success: false,
        requiresSupport: true,
        message: "A solicitação foi registrada. Esta forma de pagamento requer configuração assistida pela nossa equipe financeira para ser concluída (API Cakto pendente de endpoint oficial para troca autônoma)."
      });
    `;
    code = code.substring(0, blockStart) + replacement + code.substring(blockEnd);
    fs.writeFileSync('server/index.ts', code);
    console.log('Fixed server/index.ts payment method');
}

// And fix the other file too
let webCode = fs.readFileSync('api/cakto/update-payment-method.ts', 'utf-8');
const webBlockStart = webCode.indexOf('// REGRA: PATCH da Cakto suspenso');
if (webBlockStart !== -1) {
    const webBlockEnd = webCode.indexOf('} else {', webBlockStart);
    const replacement = `// REGRA: PATCH da Cakto suspenso e convertido em configuração assistida, sem endpoint oficial na API
      return res.status(200).json({
        success: false,
        requiresSupport: true,
        message: "A solicitação foi registrada. Esta forma de pagamento requer configuração assistida pela nossa equipe financeira para ser concluída (API Cakto pendente de endpoint oficial para troca autônoma)."
      });
    `;
    webCode = webCode.substring(0, webBlockStart) + replacement + webCode.substring(webBlockEnd);
    fs.writeFileSync('api/cakto/update-payment-method.ts', webCode);
    console.log('Fixed api/cakto/update-payment-method.ts');
}

