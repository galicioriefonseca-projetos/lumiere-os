import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];
const requiredFiles = [
  'package.json', 'package-lock.json', 'src/main.tsx', 'src/App.tsx',
  'src/lib/firebase.ts', 'src/components/ui/button.tsx', 'firestore.rules', 'firebase.json', 'vercel.json'
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`Arquivo obrigatório ausente: ${file}`);
}

for (const removedPath of ['lib', 'components', 'src/firestore.rules', 'bun.lock']) {
  if (existsSync(join(root, removedPath))) failures.push(`Estrutura duplicada/obsoleta ainda presente: ${removedPath}`);
}

const forbiddenFilePatterns = [/^patch.*\.(cjs|sh)$/i, /^fix.*\.(cjs|patch)$/i, /^restore.*\.cjs$/i, /^clean_mess\.cjs$/i, /^inspect\.(ts|js|mjs|cjs)$/i, /^debug.*\.(ts|js|mjs|cjs)$/i, /^dump.*\.(ts|js|mjs|cjs)$/i];
for (const file of readdirSync(root)) {
  if (forbiddenFilePatterns.some(pattern => pattern.test(file))) failures.push(`Script temporário encontrado na raiz: ${file}`);
}

const executableExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs']);
const forbiddenContent = [
  ['VITE_PLATFORM_ADMIN_EMAIL', 'autorização administrativa não pode depender de variável pública'],
  ['admin@lumiereos.com', 'e-mail administrativo literal'],
  ['galicioriefonseca@gmail.com', 'e-mail pessoal literal'],
  ['leandropfonseca20@gmail.com', 'e-mail pessoal de demonstração'],
  ['pix-automatic-auth', 'URL de pagamento não documentada'],
  ['ASAAS_API_KEY', 'integração legada de faturamento'],
  ['/api/asaas', 'rota legada de faturamento']
];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git'].includes(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else {
      if (relative(root, full) === 'scripts/verify-release.mjs') continue;
      const ext = entry.slice(entry.lastIndexOf('.'));
      if (!executableExtensions.has(ext)) continue;
      const text = readFileSync(full, 'utf8');
      for (const [needle, reason] of forbiddenContent) if (text.includes(needle)) failures.push(`${relative(root, full)} contém ${reason}: ${needle}`);
    }
  }
}
walk(root);

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (pkg.name !== 'lumiere-os') failures.push('package.json deve usar name=lumiere-os');
if (!pkg.version || pkg.version === '0.0.0') failures.push('package.json precisa de versão de release');
if (pkg.dependencies?.mercadopago) failures.push('Dependência legada mercadopago ainda presente');

const envExample = readFileSync(join(root, '.env.example'), 'utf8');
for (const variable of ['ASAAS_CLIENT_ID', 'ASAAS_CLIENT_SECRET', 'ASAAS_WEBHOOK_SECRET', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'VITE_TERMS_URL', 'VITE_PRIVACY_URL']) {
  if (!envExample.includes(variable)) warnings.push(`.env.example não documenta ${variable}`);
}

// Explicit Vercel API entrypoints are intentional: they avoid routing critical
// billing/webhook endpoints through a generic catch-all. Do not reject the
// release merely because /api contains more than one function.
const apiDir = join(root, 'api');
if (!existsSync(apiDir)) failures.push('Pasta /api ausente.');

if (failures.length) {
  console.error('\n❌ Verificação de release reprovada:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('✅ Estrutura de release aprovada.');
if (warnings.length) {
  console.warn('\n⚠️ Avisos:');
  warnings.forEach(warning => console.warn(`- ${warning}`));
}
