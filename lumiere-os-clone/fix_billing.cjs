const fs = require('fs');
let code = fs.readFileSync('src/lib/billing.ts', 'utf8');

code = code.replace(
  /export async function schedulePlanChange[\s\S]*?throw new Error\("Use changePlan via BillingService"\);\n\}/,
  `export async function schedulePlanChange(salonId: string, planId: string): Promise<any> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Usuário não autenticado");
  const res = await fetch('/api/billing/change-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${token}\`
    },
    body: JSON.stringify({ salonId, planId, action: 'change' })
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao alterar o plano.');
  return data;
}`
);

code = code.replace(
  /export async function cancelPlanChange[\s\S]*?throw new Error\("Not implemented"\);\n\}/,
  `export async function cancelPlanChange(salonId: string): Promise<any> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Usuário não autenticado");
  const res = await fetch('/api/billing/change-plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${token}\`
    },
    body: JSON.stringify({ salonId, action: 'cancel' })
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao cancelar agendamento de plano.');
  return data;
}`
);

fs.writeFileSync('src/lib/billing.ts', code);
