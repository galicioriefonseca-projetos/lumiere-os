const fs = require('fs');
let code = fs.readFileSync('server/index.ts', 'utf-8');

const helper = `
async function verifyIdToken(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Token ausente ou inválido");
  }
  const token = authHeader.split("Bearer ")[1];
  const adminAuth = getAdminAuth();
  return await adminAuth.verifyIdToken(token);
}
`;

if (!code.includes('async function verifyIdToken')) {
    const processIdx = code.indexOf('async function processCaktoWebhookPayload');
    code = code.substring(0, processIdx) + helper + '\n' + code.substring(processIdx);
    fs.writeFileSync('server/index.ts', code);
    console.log('Added verifyIdToken helper');
}
