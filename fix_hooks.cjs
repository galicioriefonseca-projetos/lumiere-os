const fs = require('fs');
let code = fs.readFileSync('src/pages/dashboard/SubscriptionPage.tsx', 'utf8');

code = code.replace(
  /  if \(plansLoading\) \{\n    return <div className="p-8 text-center text-zinc-500">Carregando planos\.\.\.<\/div>;\n  \}\n/g,
  ''
);

const injectionPoint = '  // Founder eligibility criteria';
code = code.replace(
  injectionPoint,
  '  if (plansLoading) {\n    return <div className="p-8 text-center text-zinc-500">Carregando planos...</div>;\n  }\n\n' + injectionPoint
);

fs.writeFileSync('src/pages/dashboard/SubscriptionPage.tsx', code);
