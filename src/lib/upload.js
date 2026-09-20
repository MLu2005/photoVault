const BLOCK = 4 * 1024 * 1024;
export function abortError() { return new DOMException('Przesyłanie anulowane.', 'AbortError'); }
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const done = () => { signal?.removeEventListener('abort', cancel); resolve(); };
    const timer = setTimeout(done, ms);
    const cancel = () => { clearTimeout(timer); reject(abortError()); };
    signal?.addEventListener('abort', cancel, { once:true });
  });
}
export function put(url, data, { headers = {}, signal, onProgress = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const xhr = new XMLHttpRequest();
    const cancel = () => xhr.abort();
    const finish = (error) => { signal?.removeEventListener('abort', cancel); error ? reject(error) : resolve(); };
    xhr.open('PUT', url); xhr.timeout = 120000;
    xhr.setRequestHeader('x-ms-version', '2023-11-03');
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = e => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { finish(); return; }
      const error = new Error(xhr.status === 403 ? 'Link uploadu wygasł lub Storage odrzucił zapis. Wybierz Ponów.' : `Storage odrzucił przesyłanie (HTTP ${xhr.status}).`);
      error.status = xhr.status; finish(error);
    };
    xhr.onerror = xhr.ontimeout = () => { const e = new Error('Brak połączenia ze Storage. Sprawdź internet i reguły CORS.'); e.status = 0; finish(e); };
    xhr.onabort = () => finish(abortError());
    signal?.addEventListener('abort', cancel, { once:true }); xhr.send(data);
  });
}
async function putWithRetry(url, data, options) {
  for (let attempt = 0; ; attempt++) {
    try { await put(url, data, options); return; }
    catch (error) {
      if (error.name === 'AbortError' || attempt >= 3 || ![0, 408, 429, 500, 502, 503, 504].includes(error.status)) throw error;
      await wait(600 * 2 ** attempt + Math.random() * 200, options.signal);
    }
  }
}
export async function uploadBlob(url, file, { contentType, signal, onProgress = () => {} } = {}) {
  const headers = { 'x-ms-blob-content-type':contentType, 'x-ms-blob-cache-control':'private, max-age=300' };
  if (file.size <= 8 * 1024 * 1024) {
    await putWithRetry(url, file, { headers:{ ...headers, 'Content-Type':contentType, 'x-ms-blob-type':'BlockBlob' }, signal, onProgress });
    onProgress(file.size); return;
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', cancel, { once:true });
  const count = Math.ceil(file.size / BLOCK);
  const loaded = new Array(count).fill(0), ids = Array.from({ length:count }, (_, i) => btoa(String(i).padStart(8, '0')));
  let next = 0, failure;
  try {
    const outcomes = await Promise.allSettled(Array.from({ length:2 }, async () => {
      while (next < count) {
        if (controller.signal.aborted) throw abortError();
        const index = next++, chunk = file.slice(index * BLOCK, Math.min(file.size, (index + 1) * BLOCK));
        const blockUrl = new URL(url); blockUrl.searchParams.set('comp', 'block'); blockUrl.searchParams.set('blockid', ids[index]);
        try {
          await putWithRetry(blockUrl.toString(), chunk, { headers:{ 'Content-Type':'application/octet-stream' }, signal:controller.signal,
            onProgress:n => { loaded[index] = Math.min(n, chunk.size); onProgress(loaded.reduce((a,b) => a + b, 0)); } });
          loaded[index] = chunk.size;
        } catch (error) { if (!failure) failure = error; controller.abort(); throw error; }
      }
    }));
    if (outcomes.some(r => r.status === 'rejected')) throw failure || abortError();
    const commitUrl = new URL(url); commitUrl.searchParams.set('comp', 'blocklist');
    await putWithRetry(commitUrl.toString(), `<?xml version="1.0" encoding="utf-8"?><BlockList>${ids.map(id => `<Latest>${id}</Latest>`).join('')}</BlockList>`,
      { headers:{ ...headers, 'Content-Type':'application/xml' }, signal:controller.signal });
    onProgress(file.size);
  } finally { signal?.removeEventListener('abort', cancel); }
}
