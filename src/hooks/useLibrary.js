import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
export function useLibrary(user) {
  const [items, setItems] = useState([]), [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [scanned, setScanned] = useState(0);
  const request = useRef(null), sequence = useRef(0), lastLoad = useRef(0);
  const refresh = useCallback(async () => {
    if (!user) return;
    const seq = ++sequence.current;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(''); setScanned(0);
    try {
      let cursor = null; const found = new Map(), names = new Set(), seen = new Set();
      do {
        const page = await api(`getPhotosByEvent${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { signal:controller.signal });
        if (seq !== sequence.current) return;
        page.items.forEach(item => found.set(item.blobName, item)); page.albums.forEach(name => names.add(name));
        setScanned(found.size); cursor = page.nextCursor;
        if (cursor && seen.has(cursor)) throw new Error('Serwer powtórzył stronę wyników. Odśwież bibliotekę.');
        if (cursor) seen.add(cursor);
      } while (cursor);
      if (seq !== sequence.current) return;
      setItems([...found.values()]); setAlbums([...names].sort((a,b) => a.localeCompare(b, 'pl'))); lastLoad.current = Date.now();
    } catch (e) { if (e.name !== 'AbortError' && seq === sequence.current) setError(e.message); }
    finally { if (seq === sequence.current) setLoading(false); }
  }, [user]);
  useEffect(() => {
    if (!user) { sequence.current++; request.current?.abort(); setItems([]); setAlbums([]); setLoading(false); setError(''); return; }
    refresh();
    const resume = () => { if (!document.hidden && Date.now() - lastLoad.current > 30 * 60000) refresh(); };
    const interval = setInterval(resume, 60000);
    document.addEventListener('visibilitychange', resume); window.addEventListener('online', resume);
    return () => { sequence.current++; request.current?.abort(); clearInterval(interval); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); };
  }, [user, refresh]);
  const patch = useCallback((name, changes) => setItems(previous => changes === null ? previous.filter(i => i.blobName !== name) : previous.map(i => i.blobName === name ? { ...i, ...changes } : i)), []);
  return { items, albums, loading, error, scanned, refresh, patch };
}
