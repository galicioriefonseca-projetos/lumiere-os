const fs = require('fs');
let code = fs.readFileSync('src/pages/dashboard/SubscriptionPage.tsx', 'utf8');

// Remove from old location
code = code.replace(
  /  if \(plansLoading\) \{\n    return <div className="p-8 text-center text-zinc-500">Carregando planos\.\.\.<\/div>;\n  \}\n/g,
  ''
);

// Add after !salonData block
const injectionPoint = '  const currentPlan = salonData.plan || \\\'start\\\';';
code = code.replace(
  injectionPoint,
  '  if (plansLoading) {\n    return <div className="p-8 text-center text-zinc-500">Carregando planos...</div>;\n  }\n\n' + injectionPoint
);

fs.writeFileSync('src/pages/dashboard/SubscriptionPage.tsx', code);
