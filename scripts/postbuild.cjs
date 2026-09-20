const fs = require('node:fs');
fs.copyFileSync('staticwebapp.config.json', 'dist/staticwebapp.config.json');
if (!fs.existsSync('dist/index.html')) throw new Error('Missing production entrypoint');
console.log('Copied SWA configuration to dist.');
