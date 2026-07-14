const fs = require('fs');

function fixType(filename) {
    let code = fs.readFileSync(filename, 'utf-8');
    const target = 'const updatePayload = { homologationUpdatedAt: Date.now() };';
    const replacement = 'const updatePayload: any = { homologationUpdatedAt: Date.now() };';
    
    if (code.includes(target)) {
        code = code.replace(target, replacement);
        fs.writeFileSync(filename, code);
        console.log(`Fixed any type in ${filename}`);
    } else {
        console.log(`Target not found in ${filename}`);
    }
}

fixType('api/cakto/webhook.ts');
fixType('server/index.ts');
