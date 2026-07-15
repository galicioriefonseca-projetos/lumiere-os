const fs = require('fs');
const config = JSON.parse(fs.readFileSync('tsconfig.json', 'utf-8'));
if (!config.exclude) config.exclude = [];
config.exclude.push('LumiereOS-v1.6.0-rc.1');
config.exclude.push('node_modules');
fs.writeFileSync('tsconfig.json', JSON.stringify(config, null, 2));
console.log('Fixed tsconfig.json');
