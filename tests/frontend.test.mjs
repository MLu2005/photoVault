import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { UploadQueue } from '../src/lib/upload-queue.js';
import { uploadBlob, put } from '../src/lib/upload.js';
import { MIME, mapSettled, bytes } from '../src/lib/format.js';
const require = createRequire(import.meta.url);
const { TYPES } = require('../api/shared/validation');
const delay = ms => new Promise(r => setTimeout(r, ms));
async function idle(queue) { for (let i=0; i<1000; i++) { if (!queue.active && !queue.jobs.some(j => j.status === 'queued')) return; await delay(5); } throw Error('Queue did not settle'); }
function file(name, size = 10) { return new File([new Uint8Array(size)], name, { lastModified:1 }); }
function transport(overrides = {}) { return { api:async (name, { body }) => name === 'getUploadUrl' ? { blobName:`${body.event}/${body.uploadId}_${body.filename}`, uploadUrl:`https://storage.test/${body.uploadId}`, thumbnailUploadUrl:'https://storage.test/thumb' } : { ok:true }, uploadBlob:async (_url,f,{onProgress}) => { await delay(10); onProgress?.(f.size); }, thumbnail:async () => null, ...overrides }; }
test('client/server MIME allowlists match and size formatting has no fabricated quota', () => { assert.deepEqual(MIME, TYPES); assert.equal(bytes(1024), '1 KB'); });
test('bounded mapper isolates failures and preserves input order', async () => {
  let active = 0, peak = 0;
  const results = await mapSettled([0,1,2,3,4], 2, async n => { active++; peak=Math.max(peak,active); await delay(10); active--; if(n===2) throw Error('partial'); return n*2; });
  assert.equal(peak,2); assert.equal(results[2].status,'rejected'); assert.equal(results[4].value,8);
});
test('queue uploads multiple files with at most three active transfers and releases successful files', async () => {
  let active=0, peak=0;
  const q=new UploadQueue({ transport:transport({ uploadBlob:async (_u,f,{onProgress}) => { active++; peak=Math.max(peak,active); await delay(20); onProgress(f.size); active--; } }) });
  const result=q.add(Array.from({length:11},(_,i)=>file(`${i}.jpg`)), 'Album'); assert.equal(result.added,11); await idle(q);
  assert.equal(peak,3); assert.ok(q.jobs.every(j=>j.status==='done' && j.file===null && j.loaded===j.size)); q.dispose();
});
test('selection de-duplicates and validates format, empty/oversized files before sending', async () => {
  const q=new UploadQueue({ maxBytes:20, transport:transport() }), same=file('same.jpg');
  const result=q.add([same,same,file('empty.png',0),file('bad.svg'),file('large.mp4',21)],'Album');
  assert.equal(result.added,1); assert.equal(result.errors.length,3); await idle(q); q.dispose();
});
test('retry reuses upload ID and does not re-upload successfully committed originals after finalization error', async () => {
  const tickets=[], original=transport(); let finals=0, sends=0;
  const q=new UploadQueue({transport:transport({ api:async (name,options) => { if(name==='getUploadUrl') tickets.push(options.body.uploadId); if(name==='completeUpload' && finals++===0) throw Error('Temporary finalization failure'); return original.api(name,options); }, uploadBlob:async ()=>{ sends++; } })});
  q.add([file('one.jpg')],'Album'); await idle(q); assert.equal(q.jobs[0].status,'error');
  q.retry(q.jobs[0].id); await idle(q); assert.equal(q.jobs[0].status,'done'); assert.equal(sends,1); assert.equal(tickets[0],tickets[1]); q.dispose();
});
test('one failed file does not fail the batch; cancel stops active and queued jobs', async () => {
  const orig=transport();
  const q=new UploadQueue({concurrency:1,transport:transport({ api:async (name,opts)=>{ if(opts.body.filename==='bad.jpg') throw Error('bad'); return orig.api(name,opts); }, uploadBlob:async (_u,_f,{signal}) => new Promise((resolve,reject)=>{ const t=setTimeout(resolve,50); signal.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('cancelled','AbortError'));},{once:true}); }) })});
  q.add([file('bad.jpg'),file('ok.jpg'),file('later.jpg')],'Album'); await delay(20); q.cancelAll(); await idle(q);
  assert.deepEqual(q.jobs.map(j=>j.status),['error','cancelled','cancelled']); q.clearFinished(); assert.equal(q.jobs.length,1); q.dispose();
});
test('disposed queue does not notify completion or start more transfers', async () => {
  let notified=0; const q=new UploadQueue({transport:transport(),onSettled:()=>notified++}); q.add([file('one.jpg')],'Album'); q.dispose(); await idle(q); assert.equal(notified,0);
});
class Xhr {
  static calls=[]; static active=0; static peak=0; static fail=null;
  constructor(){ this.upload={}; this.headers={}; }
  open(method,url){ this.method=method; this.url=url; }
  setRequestHeader(k,v){ this.headers[k]=v; }
  send(data){ this.data=data; Xhr.calls.push(this); Xhr.active++; Xhr.peak=Math.max(Xhr.peak,Xhr.active); this.timer=setTimeout(()=>{ if(this.finished)return; this.finished=true; Xhr.active--; this.upload.onprogress?.({loaded:typeof data==='string'?data.length:data.size}); this.status=Xhr.fail?.(this) || 201; this.onload(); },8); }
  abort(){ if(this.finished)return; this.finished=true;clearTimeout(this.timer);Xhr.active--;this.onabort(); }
}
function setupXhr(){ Xhr.calls=[];Xhr.active=0;Xhr.peak=0;Xhr.fail=null;globalThis.XMLHttpRequest=Xhr; }
test('small file PUT sends block blob and original MIME headers with real progress', async()=>{
  setupXhr();let progress=0;const f=file('a.jpg',100);await uploadBlob('https://storage.test/a?sig=abc',f,{contentType:'image/jpeg',onProgress:n=>progress=n});
  assert.equal(Xhr.calls.length,1);assert.equal(Xhr.calls[0].headers['x-ms-blob-type'],'BlockBlob');assert.equal(Xhr.calls[0].headers['Content-Type'],'image/jpeg');assert.equal(progress,100);
});
test('large file uses ordered 4 MiB blocks with at most two requests then block list commit',async()=>{
  setupXhr();const f=file('movie.mp4',10*1024*1024);let progress=0;await uploadBlob('https://storage.test/video?sig=abc',f,{contentType:'video/mp4',onProgress:n=>progress=n});
  assert.equal(Xhr.calls.length,4);assert.equal(Xhr.peak,2);assert.deepEqual(Xhr.calls.slice(0,3).map(x=>x.data.size),[4*1024*1024,4*1024*1024,2*1024*1024]);
  const last=Xhr.calls.at(-1);assert.equal(new URL(last.url).searchParams.get('comp'),'blocklist');assert.equal(last.headers['x-ms-blob-content-type'],'video/mp4');assert.match(last.data,/<Latest>MDAwMDAwMDA=<\/Latest>/);assert.equal(progress,f.size);
});
test('storage retries transient errors, does not retry forbidden responses or commit failed chunks',async()=>{
  setupXhr();let attempt=0;Xhr.fail=()=>attempt++===0?503:0;await uploadBlob('https://storage.test/a',file('a.jpg'),{contentType:'image/jpeg'});assert.equal(Xhr.calls.length,2);
  setupXhr();Xhr.fail=()=>403;await assert.rejects(()=>uploadBlob('https://storage.test/b',file('b.mp4',10*1024*1024),{contentType:'video/mp4'}),{status:403});assert.ok(Xhr.calls.every(x=>new URL(x.url).searchParams.get('comp')!=='blocklist'));
});
test('aborted uploads do not send or commit data',async()=>{
  setupXhr();const c=new AbortController();c.abort();await assert.rejects(()=>put('https://storage.test/a',file('a.jpg'),{signal:c.signal}),{name:'AbortError'});assert.equal(Xhr.calls.length,0);
  const d=new AbortController();const p=uploadBlob('https://storage.test/b',file('b.mp4',10*1024*1024),{contentType:'video/mp4',signal:d.signal});d.abort();await assert.rejects(()=>p,{name:'AbortError'});assert.ok(Xhr.calls.every(x=>new URL(x.url).searchParams.get('comp')!=='blocklist'));
});
