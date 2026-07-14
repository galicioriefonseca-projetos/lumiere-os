const fs = require('fs');
let code = fs.readFileSync('server/index.ts', 'utf-8');
const bracketCheck = code.lastIndexOf('}');
console.log('Last bracket at', bracketCheck);
