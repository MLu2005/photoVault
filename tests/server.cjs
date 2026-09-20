// Loopback-only isolated integration server. Never reads Azure settings or calls Azure.
// Build frontend first: npm run build; node tests/server.cjs
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {FakeStore}=require('./fake-store.cjs');const {hashPassword}=require('../api/shared/auth');const {handler,METHODS}=require('../api/shared/handlers');
const root=path.resolve(__dirname,'..'), frontend=path.resolve(root,process.env.PV_TEST_DIST||'dist'),port=4180,origin=`http://127.0.0.1:${port}`;
const store=new FakeStore(origin),blocks=new Map();const mime={'.js':'text/javascript','.jsx':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4'};
async function body(req,max=16*1024*1024){const chunks=[];let n=0;for await(const b of req){n+=b.length;if(n>max)throw Object.assign(Error('too large'),{statusCode:413});chunks.push(b);}return Buffer.concat(chunks);}
async function main(){
  if(!fs.existsSync(path.join(frontend,'index.html')))throw Error('Build first: npm run build');
  process.env.PV_APP_ORIGIN=origin;process.env.PV_DEV_HTTP='true';delete process.env.WEBSITE_HOSTNAME;delete process.env.WEBSITE_SITE_NAME;
  process.env.PV_SESSION_SECRET=crypto.randomBytes(48).toString('base64url');
  process.env.PV_USERS=JSON.stringify([{username:'tester',displayName:'Konto testowe',passwordHash:await hashPassword('Integration-test-only!')},{username:'partner',displayName:'Drugie konto',passwordHash:await hashPassword('Partner-test-only!')}]);
  const fixtureDir=path.join(__dirname,'fixtures');const photos=fs.existsSync(fixtureDir)?fs.readdirSync(fixtureDir).filter(f=>/\.jpg$/i.test(f)):[];
  if(photos.length)for(let i=0;i<12;i++)store.seed(`${['Nasz weekend','Male przyjemnosci','Podroze'][i%3]}/1759861234567_${['poranek','chwila','spacer','widok'][i%4]}-${i}.jpg`,fs.readFileSync(path.join(fixtureDir,photos[i%photos.length])),i%4===0?{pv_favorite:'true'}:{},'image/jpeg',new Date(i<8?'2026-09-10':'2026-08-20'));
  if(fs.existsSync(path.join(fixtureDir,'clip.mp4')))store.seed('Nasz weekend/1759861234567_wspomnienie.mp4',fs.readFileSync(path.join(fixtureDir,'clip.mp4')),{},'video/mp4',new Date('2026-09-12'));
  const server=http.createServer(async(req,res)=>{try{
    const url=new URL(req.url,origin);const pathname=decodeURIComponent(url.pathname);
    if(pathname.startsWith('/api/')){const name=pathname.slice(5);if(!METHODS[name]){res.writeHead(404);return res.end();}const raw=await body(req,65536),ctx={log:{error:console.error}};await handler(name,store)(ctx,{method:req.method,headers:req.headers,query:Object.fromEntries(url.searchParams),body:raw.length?JSON.parse(raw):undefined});res.writeHead(ctx.res.status,ctx.res.headers);return res.end(JSON.stringify(ctx.res.body));}
    if(pathname.startsWith('/__blob/')){
      const name=pathname.slice(8),write=req.method==='PUT';if(!store.authorized(name,url.searchParams,write)){res.writeHead(403);return res.end();}
      if(write){const data=await body(req),comp=url.searchParams.get('comp');if(comp==='block'){if(!blocks.has(name))blocks.set(name,new Map());blocks.get(name).set(url.searchParams.get('blockid'),data);}else if(comp==='blocklist'){const ids=[...data.toString().matchAll(/<Latest>(.*?)<\/Latest>/g)].map(m=>m[1]);const b=blocks.get(name);if(!b||ids.some(id=>!b.has(id)))throw Error('Invalid test block list');await store.put(name,Buffer.concat(ids.map(id=>b.get(id))),{contentType:req.headers['x-ms-blob-content-type']});blocks.delete(name);}else await store.put(name,data,{contentType:req.headers['x-ms-blob-content-type']||req.headers['content-type']});res.writeHead(201);return res.end();}
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}const b=store.blobs.get(name);if(!b){res.writeHead(404);return res.end();}
      let data=b.data,status=200;const headers={'Content-Type':b.contentType,'Accept-Ranges':'bytes','Cache-Control':'no-store'};
      if(url.searchParams.has('download'))headers['Content-Disposition']='attachment; filename="test-download"';
      if(req.headers.range){const m=/bytes=(\d+)-(\d*)/.exec(req.headers.range);if(m){const start=Number(m[1]),end=m[2]?Math.min(Number(m[2]),data.length-1):data.length-1;headers['Content-Range']=`bytes ${start}-${end}/${data.length}`;data=data.subarray(start,end+1);status=206;}}
      headers['Content-Length']=data.length;res.writeHead(status,headers);return res.end(req.method==='HEAD'?undefined:data);
    }
    let p=path.resolve(frontend,'.'+pathname);if(!p.startsWith(frontend+path.sep)&&p!==frontend){res.writeHead(403);return res.end();}
    if(pathname==='/'||!path.extname(pathname))p=path.join(frontend,'index.html');if(!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404);return res.end();}
    res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(p));
  }catch(e){res.writeHead(e.statusCode||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}});
  server.listen(port,'127.0.0.1',()=>console.log(`Isolated test fixture: ${origin} (tester / Integration-test-only!)`));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
