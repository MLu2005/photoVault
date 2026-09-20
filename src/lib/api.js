let csrfToken = null;
export function setSession(user) { csrfToken = user?.csrfToken || null; }
export async function api(endpoint, { method = 'GET', body, signal, timeout = 30000 } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', cancel, { once:true });
  const timer = setTimeout(cancel, timeout);
  try {
    const response = await fetch(`/api/${endpoint}`, { method, credentials:'same-origin', cache:'no-store', signal:controller.signal,
      headers: method === 'GET' ? { Accept:'application/json' } : { Accept:'application/json', 'Content-Type':'application/json', 'X-PV-Request':'1', ...(csrfToken ? { 'X-CSRF-Token':csrfToken } : {}) },
      ...(body === undefined ? {} : { body:JSON.stringify(body) }) });
    let data;
    try { data = await response.json(); } catch { throw new Error('API nie zwróciło poprawnej odpowiedzi. Sprawdź wdrożenie funkcji.'); }
    if (!response.ok) {
      if (response.status === 401 && endpoint !== 'authLogin') window.dispatchEvent(new Event('pv:session-expired'));
      const error = new Error(data.error || 'Operacja nie powiodła się.');
      error.status = response.status; error.code = data.code; throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError' && !signal?.aborted) throw new Error('Serwer odpowiada zbyt długo. Spróbuj ponownie.');
    if (error instanceof TypeError) throw new Error('Brak połączenia z aplikacją. Sprawdź internet i spróbuj ponownie.');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
