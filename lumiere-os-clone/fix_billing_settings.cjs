const fs = require('fs');
let code = fs.readFileSync('server/billing/BillingService.ts', 'utf8');

const replacement = `  private async getSettings(): Promise<BillingSettings> {
    const adminDb = getAdminDb();
    const doc = await adminDb.collection('settings').doc('asaas').get();

    if (!doc.exists || !doc.data()?.apiKey) {
      const defaultSettings: BillingSettings = {
        mode: 'sandbox',
        apiKey: '$aact_YTU5YTE0M2M2N2I4MTliNDQ4Njk5ZjVlOWRmYmJhZGM6Ojk1YTUxYzg5LTYyMTktNDcxNi05MmQwLTBmNTIyMjA2MDc4Yjo6NzQxOTI=',
        webhookToken: 'mock_token',
        updatedAt: Date.now()
      };
      try {
        await adminDb.collection('settings').doc('asaas').set(defaultSettings);
      } catch (e) {
        console.warn('Failed to seed default settings', e);
      }
      return defaultSettings;
    }

    return doc.data() as BillingSettings;
  }`;

code = code.replace(/private async getSettings\(\): Promise<BillingSettings> \{[\s\S]*?return data;\n  \}/m, replacement);

fs.writeFileSync('server/billing/BillingService.ts', code);
