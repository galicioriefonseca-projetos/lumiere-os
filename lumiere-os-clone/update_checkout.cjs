const fs = require('fs');
let code = fs.readFileSync('server/routes/billing/create-checkout.ts', 'utf8');

code = code.replace(
  'return res.status(200).json({ \n      success: true, \n      bankSlipUrl: `https://sandbox.asaas.com/i/${subscription.id}`,\n      asaasSubscriptionId: subscription.id\n    });',
  `
    let invoiceUrl = \`https://sandbox.asaas.com/i/\${subscription.id}\`;
    try {
      const fetchedUrl = await billingService.getSubscriptionInvoiceUrl(subscription.id);
      if (fetchedUrl) invoiceUrl = fetchedUrl;
    } catch(err) {
      console.warn('Could not fetch invoiceUrl from Asaas:', err);
    }
    
    return res.status(200).json({ 
      success: true, 
      bankSlipUrl: invoiceUrl,
      providerSubscriptionId: subscription.id
    });
  `
);
fs.writeFileSync('server/routes/billing/create-checkout.ts', code);
