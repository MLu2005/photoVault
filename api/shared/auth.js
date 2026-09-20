const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { authConfig } = require('./config');
const { fail } = require('./errors');
const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function equal(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = await scrypt(password, salt, 64, SCRYPT);
  return `scrypt$32768$8$3$${salt}$${hash.toString('hex')}`;
}
async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 256) return false;
  return equal(await hashPassword(password, encoded.split('$')[4]), encoded);
}
function sign(value, secret) { return crypto.createHmac('sha256', secret).update(value).digest('base64url'); }
function cookieName(config) { return config.devHttp ? 'pv_session' : '__Host-pv_session'; }
function cookie(value, maxAge, config = authConfig()) {
  return `${cookieName(config)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.devHttp ? '' : '; Secure'}`;
}
function createSession(user, config = authConfig(), now = Date.now()) {
  const session = { u: user.username, iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + config.ttl,
    csrf: crypto.randomBytes(24).toString('base64url'), ver: sign(user.passwordHash, config.secret) };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return { session, cookie: cookie(`${payload}.${sign(payload, config.secret)}`, config.ttl, config) };
}
function readSession(req, config = authConfig(), now = Date.now()) {
  const raw = req.headers?.cookie || '';
  const token = raw.split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName(config)}=`))?.slice(cookieName(config).length + 1);
  if (!token || token.length > 2048) return null;
  try {
    const [payload, signature, extra] = token.split('.');
    if (extra || !signature || !equal(signature, sign(payload, config.secret))) return null;
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const user = config.users.find(u => u.username === s.u);
    if (!user || !Number.isFinite(s.exp) || !Number.isFinite(s.iat) || s.exp <= now / 1000 ||
      s.iat > now / 1000 + 60 || s.exp - s.iat > config.ttl || typeof s.csrf !== 'string' ||
      s.csrf.length < 20 || !equal(s.ver, sign(user.passwordHash, config.secret))) return null;
    return { ...s, displayName: user.displayName || user.username };
  } catch { return null; }
}
function requireSession(req, config = authConfig()) {
  const session = readSession(req, config);
  if (!session) fail(401, 'Zaloguj się, aby otworzyć bibliotekę.', 'UNAUTHORIZED');
  return session;
}
function requireMutation(req, session, config = authConfig()) {
  if (req.headers?.origin !== config.origin || req.headers?.['x-pv-request'] !== '1' ||
      !/^application\/json(?:\s*;|$)/i.test(req.headers?.['content-type'] || '')) {
    fail(403, 'Niedozwolone pochodzenie lub format żądania.', 'CSRF');
  }
  if (session && !equal(req.headers?.['x-csrf-token'] || '', session.csrf)) fail(403, 'Odśwież stronę i spróbuj ponownie.', 'CSRF');
}
function publicSession(session) {
  return session ? { username: session.u, displayName: session.displayName, csrfToken: session.csrf, expiresAt: new Date(session.exp * 1000).toISOString() } : null;
}
module.exports = { hashPassword, verifyPassword, createSession, readSession, requireSession, requireMutation, publicSession, cookie, sign, equal };
