const fs = require('fs');
let code = fs.readFileSync('api/cakto/webhook.ts', 'utf-8');
const oldRet = 'return res.status(200).json({ success: false, requiresReview: true, reason: "offer_mismatch" });';
const newRet = 'return { status: 200, data: { success: false, requiresReview: true, reason: "offer_mismatch" } };';
code = code.replace(oldRet, newRet);
fs.writeFileSync('api/cakto/webhook.ts', code);
console.log('Fixed res in webhook');
