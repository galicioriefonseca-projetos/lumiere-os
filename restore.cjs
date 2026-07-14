const fs = require('fs');
const code = fs.readFileSync('api/cakto/webhook.ts', 'utf-8');

// Find the marker where the duplicated original file starts
const marker = '}type { VercelRequest, VercelResponse }';
const idx = code.indexOf(marker);

if (idx !== -1) {
    const originalCode = 'import ' + code.substring(idx + 1); // +1 because '}' belongs to newStatusBlock
    fs.writeFileSync('api/cakto/webhook-restored.ts', originalCode);
    console.log('Restored webhook to webhook-restored.ts');
} else {
    console.log('Marker not found');
}
