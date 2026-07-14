const fs = require('fs');

function fixBracket(filename) {
    let code = fs.readFileSync(filename, 'utf-8');
    const target = 'return { status: 200, data: { success: false, requiresReview: true, reason: "offer_mismatch" } };';
    const targetWeb = 'return res.status(200).json({ success: false, requiresReview: true, reason: "offer_mismatch" });';
    
    // We just need to check if there is a missing '}' after this.
    // In both cases we replaced up to the closing '}', but our string didn't include it!
    // So we just replace the return statements with themselves followed by '}'
    
    code = code.replace(target, target + '\n        }');
    code = code.replace(targetWeb, targetWeb + '\n        }');
    
    fs.writeFileSync(filename, code);
}
fixBracket('api/cakto/webhook.ts');
fixBracket('server/index.ts');
