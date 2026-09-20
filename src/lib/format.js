export const MIME = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', gif:'image/gif', avif:'image/avif', heic:'image/heic', heif:'image/heif', tif:'image/tiff', tiff:'image/tiff', mp4:'video/mp4', m4v:'video/mp4', mov:'video/quicktime', webm:'video/webm', ogv:'video/ogg', mkv:'video/x-matroska', avi:'video/x-msvideo', '3gp':'video/3gpp' };
export const ACCEPT = Object.keys(MIME).map(e => `.${e}`).join(',');
export function bytes(value = 0) {
  if (!value) return '0 B';
  const n = Math.min(Math.floor(Math.log(value) / Math.log(1024)), 4);
  return `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits:n > 1 ? 1 : 0 }).format(value / 1024 ** n)} ${['B','KB','MB','GB','TB'][n]}`;
}
export function date(value, options = {}) {
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? 'Brak daty' : new Intl.DateTimeFormat('pl-PL', { day:'numeric', month:'long', year:'numeric', ...options }).format(d);
}
export function month(value) {
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? 'Pozostałe' : new Intl.DateTimeFormat('pl-PL', { month:'long', year:'numeric' }).format(d);
}
export function extension(name) { return name.split('.').pop().toUpperCase(); }
export async function mapSettled(items, limit, action) {
  let next = 0; const results = new Array(items.length);
  await Promise.all(Array.from({ length:Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; try { results[i] = { status:'fulfilled', value:await action(items[i], i) }; } catch (reason) { results[i] = { status:'rejected', reason }; } }
  }));
  return results;
}

const plural = new Intl.PluralRules('pl');
export function counted(n, one, few, many) { return `${n} ${{one, few, many}[plural.select(n)] || many}`; }
