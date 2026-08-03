const fs = require('fs');
let code = fs.readFileSync('src/pages/dashboard/SubscriptionPage.tsx', 'utf8');

code = code.replace(
  'const planInfo = PLANS_CONFIG[currentPlan as keyof typeof PLANS_CONFIG] || PLANS_CONFIG.start;',
  `const planInfo = PLANS_CONFIG[currentPlan as keyof typeof PLANS_CONFIG] || PLANS_CONFIG.start || { name: 'Plano Atual', monthlyAmount: 0 };`
);

fs.writeFileSync('src/pages/dashboard/SubscriptionPage.tsx', code);
