const fs = require('fs');
const code = fs.readFileSync('server/index.ts', 'utf-8');

const marker = '}express from "express";';
const idx = code.indexOf(marker);

if (idx !== -1) {
    const originalCode = 'import ' + code.substring(idx + 1); // +1 because '}' belongs to newStatusBlock
    fs.writeFileSync('server/index-restored.ts', originalCode);
    console.log('Restored server to index-restored.ts');
} else {
    console.log('Marker not found in server');
}
