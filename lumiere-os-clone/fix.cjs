const fs = require('fs');

let content = fs.readFileSync('src/services/AuthService.ts', 'utf8');

const badInsertionStart = content.indexOf('          async signInWithGoogleForRegister(');
const badInsertionEnd = content.indexOf('};        try {          await setDoc');

const extractedFunctions = content.substring(badInsertionStart, badInsertionEnd);

// Remove the bad insertion
content = content.substring(0, badInsertionStart) + '};' + content.substring(badInsertionEnd + 2);

// Make sure the end of the file is correct, it might have an extra `};` at the very end
content = content.trim();
if (content.endsWith('};')) {
    content = content.substring(0, content.length - 2);
}

// Append the extracted functions properly
content = content + ',\n\n' + extractedFunctions + '\n';

fs.writeFileSync('src/services/AuthService.ts', content);
