import { useCallback, useEffect, useState } from 'react';
function read() {
  const url = new URL(location.href);
  const legacy = /^\/(?:private|public)\/([^/]+)\/?$/.exec(url.pathname);
  let album = url.searchParams.get('album') || null;
  if (legacy) { try { album = decodeURIComponent(legacy[1]); } catch {} }
  const view = url.searchParams.get('view');
  return { view:['library','albums','videos','favorites','trash','settings'].includes(view) ? view : 'library', album };
}
export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => { const update = () => setRoute(read()); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update); }, []);
  const navigate = useCallback((view, album = null) => {
    const params = new URLSearchParams(); if (view !== 'library') params.set('view', view); if (album) params.set('album', album);
    history.pushState(null, '', `/${params.size ? `?${params}` : ''}`); setRoute({ view, album }); window.scrollTo({ top:0 });
  }, []);
  return [route, navigate];
}
