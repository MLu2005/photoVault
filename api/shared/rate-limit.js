const { sign } = require('./auth');
const { fail } = require('./errors');
// Shared Blob counters survive cold starts and multiple Function instances. No database.
// Unknown usernames share one bucket; no attacker-controlled blob paths are created.
async function limitLogin(store, username, secret, now = Date.now()) {
  const name = `.pv-system/login/${sign(username, secret)}.json`;
  for (let attempt = 0; attempt < 5; attempt++) {
    let state = { start: now, count: 0 }, etag;
    try { const data = await store.read(name); state = JSON.parse(data.text); etag = data.etag; }
    catch (error) { if (error.statusCode !== 404) throw error; }
    if (now - state.start >= 15 * 60000) state = { start: now, count: 0 };
    if (state.count >= 8) fail(429, 'Za dużo prób logowania. Spróbuj ponownie za 15 minut.', 'RATE_LIMIT');
    state.count++;
    try {
      await store.put(name, JSON.stringify(state), { conditions: etag ? { ifMatch: etag } : { ifNoneMatch: '*' } });
      return;
    } catch (error) { if (![409, 412].includes(error.statusCode)) throw error; }
  }
  fail(429, 'Zbyt wiele jednoczesnych prób. Poczekaj chwilę.', 'RATE_LIMIT');
}
module.exports = { limitLogin };
