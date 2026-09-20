const { authConfig, limits } = require('./config');
const { requireSession, requireMutation, createSession, readSession, publicSession, verifyPassword, cookie } = require('./auth');
const { fail } = require('./errors');
const { limitLogin } = require('./rate-limit');
const v = require('./validation');
const { getStore } = require('./storage');
const METHODS = { authLogin:'POST', authSession:'GET', authLogout:'POST', getEventsList:'GET', getPhotosByEvent:'GET',
  createEvent:'POST', getUploadUrl:'POST', completeUpload:'POST', updateMedia:'PATCH', deletePhoto:'DELETE', deleteEvent:'DELETE', getMediaLink:'POST' };
async function mutateMetadata(store, name, change) {
  for (let i = 0; i < 3; i++) {
    const props = await store.properties(name);
    try { return await store.setMetadata(name, change({ ...(props.metadata || {}) }), props.etag); }
    catch (e) { if (e.statusCode !== 412 || i === 2) throw e; }
  }
}
function mediaItem(store, blob) {
  const m = blob.metadata || {}, p = blob.properties || {};
  const type = v.contentType(blob.name) || p.contentType || 'application/octet-stream';
  const link = store.url(blob.name);
  return { blobName: blob.name, name: v.displayName(blob.name), album: blob.name.split('/')[0], contentType: type,
    kind: type.startsWith('video/') ? 'video' : 'image', size: p.contentLength || 0, createdAt: m.pv_uploaded || p.createdOn || p.lastModified,
    lastModified: p.lastModified, favorite: m.pv_favorite === 'true', trashedAt: m.pv_trashed || null,
    thumbnailUrl: m.pv_thumb === 'true' ? store.url(v.thumbnailName(blob.name)).url : null, ...link };
}
function handler(name, injectedStore) {
  return async function(context, req) {
    let session;
    context.res = { status: 200, headers: { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store',
      'Pragma':'no-cache', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer' } };
    try {
      if (req.method?.toUpperCase() !== METHODS[name]) fail(405, 'Method not allowed.', 'METHOD_NOT_ALLOWED');
      const config = authConfig();
      const body = req.body || {}, query = req.query || {};
      if (!['authLogin', 'authSession'].includes(name)) session = requireSession(req, config);
      if (METHODS[name] !== 'GET') requireMutation(req, session, config);
      if (name === 'authSession') {
        session = readSession(req, config);
        context.res.body = { user: publicSession(session), ...(session ? { limits: limits() } : {}) }; return;
      }
      if (name === 'authLogout') {
        context.res.headers['Set-Cookie'] = cookie('', 0, config);
        context.res.body = { ok:true }; return;
      }
      const store = injectedStore || getStore();
      if (name === 'authLogin') {
        if (typeof body.username !== 'string' || typeof body.password !== 'string' || body.password.length > 256 || body.username.length > 40) fail(400, 'Enter a username and password.');
        const user = config.users.find(u => u.username === body.username.trim().toLowerCase());
        await limitLogin(store, user ? user.username : '__unknown', config.secret);
        // Dummy verification avoids a fast path for unknown usernames.
        const valid = await verifyPassword(body.password, (user || config.users[0]).passwordHash);
        if (!user || !valid) fail(401, 'Invalid username or password.', 'INVALID_CREDENTIALS');
        const result = createSession(user, config);
        context.res.headers['Set-Cookie'] = result.cookie;
        context.res.body = { user: publicSession({ ...result.session, displayName: user.displayName || user.username }), limits:limits() }; return;
      }
      if (name === 'getEventsList') {
        const page = await store.list({ hierarchy:true, cursor:v.cursor(query.cursor), limit:100 });
        context.res.body = { albums: page.prefixes.filter(p => !p.startsWith('.')).map(p => ({ name:p.slice(0, -1) })), nextCursor:page.cursor }; return;
      }
      if (name === 'getPhotosByEvent') {
        const event = query.event ? v.albumName(query.event) : null;
        const page = await store.list({ prefix: event ? `${event}/` : undefined, cursor:v.cursor(query.cursor), limit:200 });
        const albums = new Set();
        const items = [];
        for (const blob of page.items) {
          if (blob.name.endsWith(`/${v.MARKER}`)) { try { albums.add(v.albumName(blob.name.split('/')[0])); } catch {} }
          if (!v.isMedia(blob.name)) continue;
          albums.add(blob.name.split('/')[0]);
          items.push(mediaItem(store, blob));
        }
        context.res.body = { items, albums:[...albums], nextCursor:page.cursor }; return;
      }
      if (name === 'createEvent') {
        const event = v.albumName(body.event);
        try { await store.put(`${event}/${v.MARKER}`, JSON.stringify({ version:1, createdAt:new Date().toISOString() }), { conditions:{ ifNoneMatch:'*' } }); }
        catch (e) { if (![409,412].includes(e.statusCode)) throw e; }
        context.res.body = { name:event }; return;
      }
      if (name === 'getUploadUrl') {
        const blobName = v.uploadName(body.event, body.filename, body.uploadId);
        if (!Number.isSafeInteger(body.size) || body.size <= 0 || body.size > limits().maxUploadBytes) fail(400, 'The file is empty or exceeds the size limit.', 'FILE_SIZE');
        const link = store.url(blobName, { write:true });
        context.res.body = { blobName, uploadUrl:link.url, thumbnailUploadUrl:store.url(v.thumbnailName(blobName), { write:true }).url,
          expiresAt:link.expiresAt, contentType:v.contentType(body.filename), maxUploadBytes:limits().maxUploadBytes }; return;
      }
      if (name === 'completeUpload') {
        const blobName = v.mediaName(body.blobName);
        const props = await store.properties(blobName);
        if (!v.isMedia(blobName) || !props.contentLength || props.contentLength > limits().maxUploadBytes) fail(400, 'The uploaded file is invalid.', 'FILE_SIZE');
        let thumb = false;
        if (body.thumbnail === true) {
          try { const p = await store.properties(v.thumbnailName(blobName)); thumb = p.contentType === 'image/jpeg' && p.contentLength <= 1024 * 1024; }
          catch (e) { if (e.statusCode !== 404) throw e; }
        }
        await mutateMetadata(store, blobName, m => ({ ...m, pv_uploaded:m.pv_uploaded || new Date().toISOString(), pv_uploader:session.u, ...(thumb ? { pv_thumb:'true' } : {}) }));
        const p = await store.properties(blobName);
        context.res.body = { item:mediaItem(store, { name:blobName, metadata:p.metadata, properties:p }) }; return;
      }
      if (name === 'updateMedia') {
        const blobName = v.mediaName(body.blobName);
        if (typeof body.favorite !== 'boolean' && body.restore !== true) fail(400, 'There is no change to save.');
        await mutateMetadata(store, blobName, m => {
          if (body.restore === true) delete m.pv_trashed;
          if (typeof body.favorite === 'boolean') m.pv_favorite = String(body.favorite);
          return m;
        });
        context.res.body = { ok:true }; return;
      }
      if (name === 'deletePhoto') {
        const blobName = v.mediaName(body.blobName);
        if (body.permanent === true) {
          const props = await store.properties(blobName);
          if (!props.metadata?.pv_trashed) fail(409, 'Move the file to trash first.', 'NOT_TRASHED');
          await store.remove(v.thumbnailName(blobName));
          await store.remove(blobName);
        } else { await mutateMetadata(store, blobName, m => ({ ...m, pv_trashed:m.pv_trashed || new Date().toISOString() })); }
        context.res.body = { ok:true }; return;
      }
      if (name === 'deleteEvent') {
        const event = v.albumName(body.event);
        const page = await store.list({ prefix:`${event}/`, cursor:v.cursor(body.cursor), limit:60 });
        const media = page.items.filter(b => v.isMedia(b.name) && !b.metadata?.pv_trashed);
        let index = 0;
        const outcomes = await Promise.allSettled(Array.from({ length:Math.min(4, media.length) }, async () => {
          while (index < media.length) {
            const blob = media[index++];
            await mutateMetadata(store, blob.name, m => ({ ...m, pv_trashed:m.pv_trashed || new Date().toISOString() }));
          }
        }));
        if (outcomes.some(o => o.status === 'rejected')) fail(503, 'Some files were moved. Retry the operation to finish.', 'PARTIAL_OPERATION');
        context.res.body = { moved:media.length, nextCursor:page.cursor }; return;
      }
      if (name === 'getMediaLink') {
        const blobName = v.mediaName(body.blobName);
        await store.properties(blobName);
        context.res.body = store.url(blobName, { download:body.download === true, filename:v.displayName(blobName) }); return;
      }
      fail(404, 'Operation not found.');
    } catch (error) {
      const status = error.status || (error.statusCode === 404 ? 404 : error.statusCode === 412 ? 409 : 500);
      context.res.status = status;
      context.res.body = { error:status === 500 ? 'The operation failed. Please try again.' : (error.status ? error.message : status === 404 ? 'The file does not exist.' : 'The file changed. Refresh the library.'), code:error.code || 'REQUEST_FAILED' };
      if (status === 429) context.res.headers['Retry-After'] = '900';
      if (status === 405) context.res.headers.Allow = METHODS[name];
      // Never log req.body, SAS URLs, cookies, password hashes or full Azure error objects.
      if (status >= 500) context.log?.error?.(`PhotoVault ${name}: ${error.code || error.name || 'error'}`);
    }
  };
}
module.exports = { handler, METHODS, mediaItem, mutateMetadata };
