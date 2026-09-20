const crypto = require('node:crypto');
function storageError(statusCode) { return Object.assign(new Error(`Test storage HTTP ${statusCode}`), { statusCode }); }
class FakeStore {
  constructor(base = 'https://storage.example.test') { this.blobs = new Map(); this.base = base; this.version = 0; this.secret = crypto.randomBytes(32); this.urlCalls = 0; this.conflicts = 0; }
  seed(name, data = 'image-data', metadata = {}, contentType = 'image/jpeg', createdOn = new Date('2026-06-10T10:00:00Z')) {
    this.blobs.set(name, { data:Buffer.from(data), metadata:{ ...metadata }, contentType, createdOn, lastModified:createdOn, etag:String(++this.version) }); return name;
  }
  async properties(name) { const b = this.blobs.get(name); if (!b) throw storageError(404); return { metadata:{ ...b.metadata }, contentLength:b.data.length, contentType:b.contentType, createdOn:b.createdOn, lastModified:b.lastModified, etag:b.etag }; }
  async list({ prefix = '', cursor, limit = 200, hierarchy = false } = {}) {
    const names = [...this.blobs.keys()].filter(n => n.startsWith(prefix)).sort();
    if (hierarchy) {
      const all = [...new Set(names.filter(n => n.includes('/')).map(n => n.split('/')[0] + '/'))];
      const start = Number(cursor || 0), selected = all.slice(start, start + limit);
      return { prefixes:selected, items:[], cursor:start + limit < all.length ? String(start + limit) : null };
    }
    const start = Number(cursor || 0), selected = names.slice(start, start + limit);
    return { items:await Promise.all(selected.map(async name => { const properties = await this.properties(name); return { name, properties, metadata:properties.metadata }; })), prefixes:[], cursor:start + limit < names.length ? String(start + limit) : null };
  }
  async read(name) { const b = this.blobs.get(name); if (!b) throw storageError(404); return { text:b.data.toString(), etag:b.etag }; }
  async put(name, data, { conditions = {}, contentType = 'application/json', metadata } = {}) {
    const b = this.blobs.get(name);
    if (conditions.ifNoneMatch === '*' && b || conditions.ifMatch && b?.etag !== conditions.ifMatch) throw storageError(412);
    return this.seed(name, data, metadata || {}, contentType, b?.createdOn || new Date());
  }
  async setMetadata(name, metadata, etag) {
    const b = this.blobs.get(name); if (!b) throw storageError(404);
    if (this.conflicts > 0) { this.conflicts--; throw storageError(412); }
    if (etag && etag !== b.etag) throw storageError(412);
    b.metadata = { ...metadata }; b.etag = String(++this.version); b.lastModified = new Date(); return { etag:b.etag };
  }
  async remove(name) { return this.blobs.delete(name); }
  signature(name, permission, expiry) { return crypto.createHmac('sha256', this.secret).update(`${name}|${permission}|${expiry}`).digest('hex'); }
  url(name, { write = false, download = false } = {}) {
    this.urlCalls++; const expiry = Date.now() + 3600000, permission = write ? 'w' : 'r';
    const q = new URLSearchParams({ permission, expiry:String(expiry), sig:this.signature(name, permission, expiry), ...(download ? { download:'1' } : {}) });
    return { url:`${this.base}/__blob/${name.split('/').map(encodeURIComponent).join('/')}?${q}`, expiresAt:new Date(expiry).toISOString() };
  }
  authorized(name, params, write = false) { const p = params.get('permission'), e = params.get('expiry'); return Number(e) > Date.now() && p === (write ? 'w' : 'r') && params.get('sig') === this.signature(name, p, e); }
}
module.exports = { FakeStore, storageError };
