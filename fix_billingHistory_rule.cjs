const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(
  'allow read: if canManageSalon(salonId) || canManageBilling(salonId);',
  'allow read: if canManageSalon(salonId);'
);

fs.writeFileSync('firestore.rules', code);
