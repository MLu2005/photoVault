#!/usr/bin/env node
// Local-only HTTP adapter. Production uses Azure Functions function.json bindings.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const settingsPath = path.join(__dirname,'../api/local.settings.json');
if (!fs.existsSync(settingsPath)) { console.error('Run npm run setup first, then fill api/local.settings.json.'); process.exit(1); }
const config = JSON.parse(fs.readFileSync(settingsPath,'utf8'));
for (const [name,value] of Object.entries(config.Values || {})) process.env[name] = String(value);
const { handler, METHODS } = require('../api/shared/handlers');
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url,'http://127.0.0.1:7071');
  const name = url.pathname.replace(/^\/api\//,'');
  if (!Object.hasOwn(METHODS,name)) { res.writeHead(404,{'Content-Type':'application/json'}); res.end('{"error":"Unknown endpoint"}'); return; }
  try {
    let text = '';
    for await (const chunk of req) { text += chunk; if (text.length > 65536) { res.writeHead(413); res.end(); return; } }
    let body;
    try { body = text ? JSON.parse(text) : undefined; } catch { res.writeHead(400); res.end('{"error":"Invalid JSON"}'); return; }
    const context = { log:{ error:console.error } };
    await handler(name)(context, { method:req.method, headers:req.headers, query:Object.fromEntries(url.searchParams), body });
    res.writeHead(context.res.status,context.res.headers); res.end(JSON.stringify(context.res.body));
  } catch { res.writeHead(500); res.end('{"error":"Local API error"}'); }
});
server.listen(7071,'127.0.0.1',() => console.log('Local API: http://127.0.0.1:7071 (Azure Storage backend; not for production)'));
