const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(
  '    match /users/{userId} {',
  '    // Plans (Public read)\n    match /plans/{planId} {\n      allow read: if true;\n      allow write: if isPlatformAdmin();\n    }\n\n    match /users/{userId} {'
);

fs.writeFileSync('firestore.rules', code);
