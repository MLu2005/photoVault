const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const { METHODS } = require('../api/shared/handlers');
let count = 0;
function check(folder) {
  for (const item of fs.readdirSync(folder,{ withFileTypes:true })) {
    if (['node_modules','dist','.local-test','.private-backups','test-results'].includes(item.name)) continue;
    const file = path.join(folder,item.name);
    if (item.isDirectory()) check(file);
    else if (/\.(?:js|cjs|mjs)$/.test(file)) { cp.execFileSync(process.execPath,['--check',file],{ stdio:'pipe' }); count++; }
    else if (file.endsWith('.json') && !file.endsWith('local.settings.json') && !file.endsWith('.photovault-secrets.json')) JSON.parse(fs.readFileSync(file,'utf8'));
  }
}
check(root);
for (const [name,method] of Object.entries(METHODS)) {
  const config = JSON.parse(fs.readFileSync(path.join(root,'api',name,'function.json'),'utf8'));
  const trigger = config.bindings.find(b => b.type === 'httpTrigger');
  assert.equal(trigger.route,name); assert.deepEqual(trigger.methods,[method.toLowerCase()]);
  assert.equal(trigger.authLevel,'anonymous');
}
const swa = JSON.parse(fs.readFileSync(path.join(root,'staticwebapp.config.json'),'utf8'));
assert.equal(swa.platform.apiRuntime,'node:22');
assert(!swa.routes.some(r => r.allowedRoles?.includes('authenticated')), 'SWA built-in auth would conflict with own sessions');
assert(swa.navigationFallback.exclude.includes('/api/*'));
const frontend = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
assert(!frontend.dependencies['@azure/storage-blob'], 'Storage keys / server SDK must stay in API');
console.log(`Checked ${count} JS modules, JSON configuration and ${Object.keys(METHODS).length} Function bindings. JSX compilation is checked by npm run build.`);
