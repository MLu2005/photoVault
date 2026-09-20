const crypto = require('node:crypto');
const { fail } = require('./errors');
const TYPES = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', gif:'image/gif', avif:'image/avif', heic:'image/heic', heif:'image/heif', tif:'image/tiff', tiff:'image/tiff', mp4:'video/mp4', m4v:'video/mp4', mov:'video/quicktime', webm:'video/webm', ogv:'video/ogg', mkv:'video/x-matroska', avi:'video/x-msvideo', '3gp':'video/3gpp' };
const MARKER = '.pv-album.json';
function albumName(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 120 || value !== value.trim() ||
      /[\/\\\u0000-\u001f\u007f]/.test(value) || value.startsWith('.')) fail(400, 'Nazwa albumu: 1–120 znaków, bez /, \\ i kropki na początku.', 'INVALID_ALBUM');
  return value;
}
function fileName(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || /[\/\\\u0000-\u001f\u007f]/.test(value) || value.startsWith('.')) fail(400, 'Nieprawidłowa nazwa pliku.', 'INVALID_FILE');
  return value;
}
function contentType(name) { return TYPES[name.split('.').pop().toLowerCase()] || null; }
function mediaName(value) {
  if (typeof value !== 'string' || value.length > 1024) fail(400, 'Nieprawidłowy plik.', 'INVALID_FILE');
  const parts = value.split('/');
  albumName(parts[0]);
  if (parts.length < 2 || parts.slice(1).some(p => !p || p.startsWith('.') || /[\\\u0000-\u001f\u007f]/.test(p))) fail(400, 'Nieprawidłowa ścieżka pliku.', 'INVALID_FILE');
  return value;
}
function isMedia(name) {
  try { mediaName(name); return !!contentType(name); } catch { return false; }
}
function thumbnailName(name) { return `${name.split('/')[0]}/.pv-thumbs/${crypto.createHash('sha256').update(name).digest('hex')}.jpg`; }
function uploadName(event, filename, uploadId) {
  albumName(event); fileName(filename);
  if (!contentType(filename)) fail(400, 'Ten format nie jest obsługiwany. Wybierz zdjęcie lub film.', 'UNSUPPORTED_FILE');
  if (uploadId && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadId)) fail(400, 'Nieprawidłowy identyfikator uploadu.', 'INVALID_FILE');
  return `${event}/${uploadId || crypto.randomUUID()}_${filename}`;
}
function displayName(name) { return name.split('/').pop().replace(/^(?:\d{13}|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})_/i, ''); }
function cursor(value) {
  if (value !== undefined && value !== null && value !== '' && (typeof value !== 'string' || value.length > 4096)) fail(400, 'Nieprawidłowa strona wyników.', 'INVALID_CURSOR');
  return value || undefined;
}
module.exports = { TYPES, MARKER, albumName, fileName, contentType, mediaName, isMedia, thumbnailName, uploadName, displayName, cursor };
