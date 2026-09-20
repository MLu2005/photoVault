const { fail } = require('./errors');
function numberSetting(name, fallback, min, max) {
  const n = Number(process.env[name] || fallback);
  if (!Number.isFinite(n) || n < min || n > max) fail(503, `Invalid server setting: ${name}`, 'CONFIGURATION');
  return n;
}
function authConfig() {
  const secret = process.env.PV_SESSION_SECRET || '';
  if (secret.length < 32) fail(503, 'Configure PV_SESSION_SECRET and PV_USERS in the API settings.', 'CONFIGURATION');
  let users;
  try { users = JSON.parse(process.env.PV_USERS || 'null'); } catch { /* checked below */ }
  if (!Array.isArray(users) || !users.length || users.length > 10 || users.some(u =>
    !u || !/^[a-z0-9._-]{3,40}$/.test(u.username) || typeof u.passwordHash !== 'string' ||
    !/^scrypt\$32768\$8\$3\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(u.passwordHash) ||
    (u.displayName !== undefined && (typeof u.displayName !== 'string' || u.displayName.length > 60))) ||
    new Set(users.map(u => u.username)).size !== users.length) {
    fail(503, 'PV_USERS account configuration is invalid. Run npm run setup.', 'CONFIGURATION');
  }
  const devHttp = process.env.PV_DEV_HTTP === 'true' && !process.env.WEBSITE_HOSTNAME && !process.env.WEBSITE_SITE_NAME;
  let origin;
  try {
    const url = new URL(process.env.PV_APP_ORIGIN);
    if (url.origin !== process.env.PV_APP_ORIGIN || (url.protocol !== 'https:' && !(devHttp && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw Error();
    origin = url.origin;
  } catch { fail(503, 'PV_APP_ORIGIN must contain the exact app URL without a trailing /.', 'CONFIGURATION'); }
  return { secret, users, origin, devHttp, ttl: numberSetting('PV_SESSION_DAYS', 7, 1, 30) * 86400 };
}
function limits() { return { maxUploadBytes: numberSetting('PV_MAX_UPLOAD_MB', 1024, 1, 10240) * 1024 * 1024 }; }
module.exports = { authConfig, limits, numberSetting };
