const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { FakeStore } = require('./fake-store.cjs');
const { authConfig } = require('../api/shared/config');
const auth = require('../api/shared/auth');
const v = require('../api/shared/validation');
const { handler, METHODS } = require('../api/shared/handlers');
const { limitLogin } = require('../api/shared/rate-limit');
let config, user, current;
before(async () => {
  process.env.PV_APP_ORIGIN = 'https://vault.example.test';
  process.env.PV_SESSION_SECRET = 'unit-tests-only-not-a-deployment-secret-12345';
  delete process.env.PV_DEV_HTTP;
  user = { username:'tester', displayName:'Test person', passwordHash:await auth.hashPassword('Test fixture password!') };
  process.env.PV_USERS = JSON.stringify([user]); config = authConfig(); current = auth.createSession(user, config);
});
async function call(name, store = new FakeStore(), { body, query, headers, anonymous = false, method } = {}) {
  const req = { method:method || METHODS[name], body, query, headers:{ origin:config.origin, 'content-type':'application/json', 'x-pv-request':'1', ...(anonymous ? {} : { cookie:current.cookie.split(';')[0], 'x-csrf-token':current.session.csrf }), ...headers } };
  const ctx = { log:{ error:() => {} } }; await handler(name, store)(ctx, req); return ctx.res;
}
test('password scrypt hashes salted and verifies, rejects wrong/oversized passwords', async () => {
  assert.equal(await auth.verifyPassword('Test fixture password!', user.passwordHash), true);
  assert.equal(await auth.verifyPassword('not-it', user.passwordHash), false);
  assert.equal(await auth.verifyPassword('x'.repeat(257), user.passwordHash), false);
  assert.notEqual(await auth.hashPassword('Test fixture password!'), user.passwordHash);
});
test('session is HttpOnly, Secure, same-site, signed, and expires', () => {
  assert.match(current.cookie, /^__Host-pv_session=/); assert.match(current.cookie, /HttpOnly; SameSite=Strict/); assert.match(current.cookie, /; Secure$/);
  assert.equal(auth.readSession({ headers:{ cookie:current.cookie } }, config).u, 'tester');
  assert.equal(auth.readSession({ headers:{ cookie:current.cookie } }, config, Date.now() + 8 * 86400000), null);
  assert.equal(auth.readSession({ headers:{ cookie:current.cookie.replace('=', '=X') } }, config), null);
  assert.equal(auth.readSession({ headers:{ cookie:current.cookie } }, { ...config, secret:'rotated' }), null);
  assert.equal(auth.readSession({ headers:{ cookie:current.cookie } }, { ...config, users:[] }), null);
  assert.equal(auth.readSession({ headers:{ cookie:current.cookie } }, { ...config, users:[{ ...user, passwordHash:'changed' }] }), null);
});
test('every private endpoint refuses unauthenticated access before storage/SAS generation', async () => {
  for (const name of Object.keys(METHODS).filter(n => !['authLogin', 'authSession'].includes(n))) {
    const store = new FakeStore(), res = await call(name, store, { anonymous:true }); assert.equal(res.status, 401, name); assert.equal(store.urlCalls, 0);
  }
});
test('anonymous session response contains no library, limits or secrets', async () => {
  const res = await call('authSession', undefined, { anonymous:true }); assert.deepEqual(res.body, { user:null }); assert.equal(res.headers['Cache-Control'], 'no-store');
});
test('wrong methods and all mutation CSRF variants rejected', async () => {
  assert.equal((await call('getUploadUrl', undefined, { method:'GET' })).status, 405);
  for (const name of Object.keys(METHODS).filter(n => METHODS[n] !== 'GET')) {
    for (const headers of [{ origin:'https://evil.example.test' }, { 'x-pv-request':'' }, { 'content-type':'text/plain' }]) assert.equal((await call(name, undefined, { headers })).status, 403, name);
    if (name !== 'authLogin') assert.equal((await call(name, undefined, { headers:{ 'x-csrf-token':'wrong' } })).status, 403, name);
  }
});
test('valid login returns cookie, public profile and csrf; invalid credentials generic', async () => {
  const store = new FakeStore();
  const good = await call('authLogin', store, { anonymous:true, body:{ username:' TESTER ', password:'Test fixture password!' } });
  assert.equal(good.status, 200); assert.equal(good.body.user.username, 'tester'); assert.ok(good.body.user.csrfToken); assert.ok(good.headers['Set-Cookie']);
  assert.equal(JSON.stringify(good.body).includes('passwordHash'), false);
  const wrong = await call('authLogin', store, { anonymous:true, body:{ username:'tester', password:'bad' } });
  const unknown = await call('authLogin', store, { anonymous:true, body:{ username:'nobody', password:'bad' } });
  assert.equal(wrong.status, 401); assert.deepEqual(wrong.body, unknown.body);
  assert.match((await call('authLogout')).headers['Set-Cookie'], /Max-Age=0/);
});
test('shared login limiter blocks ninth request and resets after 15 minutes', async () => {
  const store = new FakeStore(), now = Date.now();
  for (let i = 0; i < 8; i++) await limitLogin(store, 'tester', config.secret, now);
  await assert.rejects(() => limitLogin(store, 'tester', config.secret, now), { status:429 });
  await limitLogin(store, 'tester', config.secret, now + 900001);
  assert.equal(store.blobs.size, 1);
});
test('album and file validation prevents traversal/system files and unsupported active content', () => {
  for (const name of ['../x', '.system', '', ' bad ', 'a/b', 'a\\b', 'x\0']) assert.throws(() => v.albumName(name));
  for (const name of ['../bad.jpg', '.pv-system/login/a.json', 'Album/.pv-thumbs/a.jpg', 'Album/../x.jpg']) assert.throws(() => v.mediaName(name));
  assert.equal(v.albumName('Lato & morze'), 'Lato & morze'); assert.equal(v.isMedia('Legacy/1234567890000_IMG.MOV'), true);
  assert.throws(() => v.uploadName('Lato','a.svg')); assert.throws(() => v.uploadName('Lato','a.html'));
  assert.equal(v.displayName('Lato/1759861234567_photo.jpg'), 'photo.jpg');
});
test('upload tickets support stable UUID retries and reject empty, oversized or invalid files', async () => {
  const store = new FakeStore(), body = { event:'Lato & morze', filename:'movie.MP4', size:42, uploadId:'7cdb75bd-9e87-4455-a067-b1b5e43aed68' };
  const a = await call('getUploadUrl', store, { body }), b = await call('getUploadUrl', store, { body });
  assert.equal(a.status, 200); assert.equal(a.body.blobName, b.body.blobName); assert.equal(a.body.contentType, 'video/mp4'); assert.match(a.body.uploadUrl, /permission=w/);
  for (const change of [{ size:0 },{ size:2**40 },{ filename:'a.svg' },{ event:'../secret' },{ uploadId:'../../x' }]) assert.equal((await call('getUploadUrl', store, { body:{ ...body, ...change } })).status, 400);
});
test('empty albums are idempotent and discoverable, legacy media visible, internal files hidden', async () => {
  const store = new FakeStore();
  store.seed('Old/1759861234567_pic.jpg'); store.seed('Old/movie.mp4', 'video', {}, 'video/mp4');
  store.seed('Old/.pv-thumbs/t.jpg'); store.seed('.pv-system/login/private.json');
  for (let i = 0; i < 2; i++) assert.equal((await call('createEvent', store, { body:{ event:'Empty' } })).status, 200);
  const r = await call('getPhotosByEvent', store); assert.equal(r.body.items.length, 2); assert.ok(r.body.albums.includes('Empty')); assert.equal(r.body.items.find(i => i.kind === 'video').contentType, 'video/mp4');
  const list = await call('getEventsList', store); assert.deepEqual(list.body.albums, [{ name:'Empty' },{ name:'Old' }]);
});
test('media paging is bounded and cursor exposes all items without duplication', async () => {
  const store = new FakeStore(); for (let i = 0; i < 235; i++) store.seed(`Many/${String(i).padStart(4,'0')}.jpg`);
  const a = await call('getPhotosByEvent', store); assert.equal(a.body.items.length, 200); assert.ok(a.body.nextCursor);
  const b = await call('getPhotosByEvent', store, { query:{ cursor:a.body.nextCursor } }); assert.equal(b.body.items.length, 35); assert.equal(b.body.nextCursor, null);
  assert.equal(new Set([...a.body.items,...b.body.items].map(i => i.blobName)).size, 235);
});
test('finalize verifies storage size and associates optional thumbnail without modifying originals', async () => {
  const store = new FakeStore(), name = store.seed('New/pic.jpg', 'original-jpeg-bytes');
  store.seed(v.thumbnailName(name), 'jpeg', {}, 'image/jpeg');
  const r = await call('completeUpload', store, { body:{ blobName:name, thumbnail:true } });
  assert.equal(r.status, 200); assert.ok(r.body.item.thumbnailUrl); assert.equal(store.blobs.get(name).data.toString(), 'original-jpeg-bytes'); assert.equal(store.blobs.get(name).metadata.pv_uploader, 'tester');
  store.seed('New/empty.jpg', ''); assert.equal((await call('completeUpload', store, { body:{ blobName:'New/empty.jpg' } })).status, 400);
});
test('favorite, trash and restore preserve other metadata, retry etag conflicts', async () => {
  const store = new FakeStore(), blobName = store.seed('Trip/pic.jpg', 'original', { existing:'preserve' }); store.conflicts = 1;
  assert.equal((await call('updateMedia', store, { body:{ blobName, favorite:true } })).status, 200);
  assert.equal((await call('deletePhoto', store, { body:{ blobName } })).status, 200);
  assert.equal(store.blobs.get(blobName).data.toString(), 'original'); assert.ok(store.blobs.get(blobName).metadata.pv_trashed);
  assert.equal((await call('updateMedia', store, { body:{ blobName, restore:true } })).status, 200);
  assert.deepEqual(store.blobs.get(blobName).metadata, { existing:'preserve', pv_favorite:'true' });
});
test('permanent delete requires trash state and removes derived thumbnail only', async () => {
  const store = new FakeStore(), blobName = store.seed('Trip/pic.jpg'); store.seed(v.thumbnailName(blobName)); store.seed('Trip/other.jpg');
  assert.equal((await call('deletePhoto', store, { body:{ blobName, permanent:true } })).status, 409);
  await call('deletePhoto', store, { body:{ blobName } }); assert.equal((await call('deletePhoto', store, { body:{ blobName, permanent:true } })).status, 200);
  assert.equal(store.blobs.has(blobName), false); assert.equal(store.blobs.has(v.thumbnailName(blobName)), false); assert.equal(store.blobs.has('Trip/other.jpg'), true);
});
test('album trash uses bounded pages and keeps other albums plus empty marker intact', async () => {
  const store = new FakeStore(); for (let i=0;i<75;i++) store.seed(`Trip/${String(i).padStart(3,'0')}.jpg`);
  store.seed(`Trip/${v.MARKER}`, '{}'); store.seed('Trip-other/safe.jpg');
  let cursor=null, moved=0; do { const r = await call('deleteEvent', store, { body:{ event:'Trip', cursor } }); assert.equal(r.status, 200); moved += r.body.moved; cursor=r.body.nextCursor; } while(cursor);
  assert.equal(moved, 75); assert.equal(store.blobs.get('Trip-other/safe.jpg').metadata.pv_trashed, undefined); assert.equal(store.blobs.has(`Trip/${v.MARKER}`), true);
});
test('fresh read/download links require session and valid existing media path', async () => {
  const store = new FakeStore(), blobName = store.seed('Trip/photo.jpg');
  assert.match((await call('getMediaLink', store, { body:{ blobName, download:true } })).body.url, /download=1/);
  assert.equal((await call('getMediaLink', store, { body:{ blobName:'.pv-system/secrets.json' } })).status, 400);
  assert.equal((await call('getMediaLink', store, { body:{ blobName:'Missing/photo.jpg' } })).status, 404);
});
