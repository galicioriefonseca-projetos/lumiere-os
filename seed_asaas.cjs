const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
async function run() {
  await db.collection('settings').doc('asaas').set({
    mode: 'sandbox',
    apiKey: '$aact_YTU5YTE0M2M2N2I4MTliNDQ4Njk5ZjVlOWRmYmJhZGM6Ojk1YTUxYzg5LTYyMTktNDcxNi05MmQwLTBmNTIyMjA2MDc4Yjo6NzQxOTI=',
    webhookToken: 'mock_token',
    updatedAt: Date.now()
  });
  console.log("Seeded Asaas settings.");
  process.exit(0);
}
run();
