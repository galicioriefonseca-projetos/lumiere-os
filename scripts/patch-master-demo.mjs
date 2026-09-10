import fs from 'node:fs';

const path = 'src/pages/MasterPanel.tsx';
let source = fs.readFileSync(path, 'utf8');

if (!source.includes("DemoControlCard")) {
  source = source.replace(
    "import { APP_INFO } from '../config/appInfo';",
    "import { APP_INFO } from '../config/appInfo';\nimport DemoControlCard from '../components/admin/DemoControlCard';"
  );
}

source = source.replace(
  "const [activeTab, setActiveTab] = useState<'salons' | 'bugs' | 'asaas'>('salons');",
  "const [activeTab, setActiveTab] = useState<'salons' | 'bugs' | 'asaas' | 'demo'>('salons');"
);

const marker = "          <button\n            onClick={() => setActiveTab('bugs')}";
if (!source.includes("setActiveTab('demo')")) {
  const demoButton = `          <button\n            onClick={() => setActiveTab('demo')}\n            className={\`px-4 py-2.5 text-sm font-medium border-b-2 transition-all relative \${\n              activeTab === 'demo'\n                ? 'border-[#D4AF37] text-[#D4AF37] font-semibold'\n                : 'border-transparent text-muted-foreground hover:text-foreground'\n            }\`}\n          >\n            Demonstração\n          </button>\n`;
  if (!source.includes(marker)) throw new Error('Marcador da aba de problemas não encontrado.');
  source = source.replace(marker, demoButton + marker);
}

const renderMarker = "        {activeTab === 'salons' && (";
if (!source.includes("activeTab === 'demo'")) {
  const demoSection = `        {activeTab === 'demo' && (\n          <DemoControlCard salonId={salons.find((salon) => /lumiere\\s*beauty/i.test(salon.name || ''))?.id} />\n        )}\n\n`;
  if (!source.includes(renderMarker)) throw new Error('Marcador da área de empresas não encontrado.');
  source = source.replace(renderMarker, demoSection + renderMarker);
}

fs.writeFileSync(path, source);
console.log('MasterPanel atualizado com a área de Demonstração.');
