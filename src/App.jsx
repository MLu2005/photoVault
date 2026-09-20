import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, setSession } from './lib/api.js';
import { bytes, counted, date, mapSettled, month } from './lib/format.js';
import { UploadQueue } from './lib/upload-queue.js';
import { useLibrary } from './hooks/useLibrary.js';
import { useRoute } from './hooks/useRoute.js';
import Icon, { IconButton } from './components/Icon.jsx';
import Login from './components/Login.jsx';
import Modal from './components/Modal.jsx';
import { MediaCard, MediaRow, Preview } from './components/Media.jsx';
import Lightbox from './components/Lightbox.jsx';
import UploadDialog from './components/UploadDialog.jsx';
import UploadPanel from './components/UploadPanel.jsx';
const TITLES = { library:'Wszystkie wspomnienia', albums:'Wasze albumy', videos:'Filmy', favorites:'Ulubione', trash:'Kosz', settings:'Wasza przestrzeń' };
function readPreference(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }
function savePreference(key, value) { try { localStorage.setItem(key, value); } catch {} }
export default function App() {
  const [session, updateSession] = useState(null), [checking, setChecking] = useState(true), [authError, setAuthError] = useState('');
  const [theme, setTheme] = useState(() => readPreference('pv-theme', 'light'));
  const applySession = useCallback(data => { setSession(data?.user); updateSession(data?.user ? data : null); setAuthError(''); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; savePreference('pv-theme', theme); }, [theme]);
  useEffect(() => {
    const controller = new AbortController();
    api('authSession', { signal:controller.signal }).then(applySession).catch(e => { if (e.name !== 'AbortError') setAuthError(e.message); }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    const expired = () => { setSession(null); updateSession(null); setAuthError('Sesja wygasła. Zaloguj się ponownie.'); };
    window.addEventListener('pv:session-expired', expired);
    return () => { controller.abort(); window.removeEventListener('pv:session-expired', expired); };
  }, [applySession]);
  if (checking) return <div className="boot-screen"><span className="brand-mark"><Icon name="vault" size={28}/></span><h1>photovault</h1><p><span className="spinner"/>{'Otwieranie Waszej przestrzeni...'}</p></div>;
  if (!session) return <Login onLogin={applySession} initialError={authError}/>;
  return <LibraryApp user={session.user} limits={session.limits} theme={theme} setTheme={setTheme} onLogout={() => applySession(null)}/>;
}
function LibraryApp({ user, limits, theme, setTheme, onLogout }) {
  const library = useLibrary(user), [route, navigate] = useRoute();
  const [query, setQuery] = useState(''), [sort, setSort] = useState('newest'), [type, setType] = useState('all');
  const [layout, setLayout] = useState(() => readPreference('pv-layout', 'grid'));
  const [mobileNav, setMobileNav] = useState(false), [selected, setSelected] = useState(new Set()), [selectMode, setSelectMode] = useState(false);
  const [dialog, setDialog] = useState(null), [newAlbum, setNewAlbum] = useState(''), [dialogError, setDialogError] = useState('');
  const [upload, setUpload] = useState(null), [jobs, setJobs] = useState([]), [viewer, setViewer] = useState(-1);
  const [busy, setBusy] = useState(false), [toast, setToast] = useState(null), [visibleCount, setVisibleCount] = useState(60), [drag, setDrag] = useState(false);
  const searchRef = useRef(null), refreshRef = useRef(library.refresh), refreshTimer = useRef(null);
  refreshRef.current = library.refresh;
  const [queue] = useState(() => new UploadQueue({ maxBytes:limits.maxUploadBytes, onSettled:() => {
    clearTimeout(refreshTimer.current); refreshTimer.current = setTimeout(() => refreshRef.current(), 450);
  } }));
  useEffect(() => { queue.disposed = false; const unsubscribe = queue.subscribe(setJobs); return () => { unsubscribe(); queue.dispose(); clearTimeout(refreshTimer.current); }; }, [queue]);
  const activeJobs = jobs.some(j => ['queued','uploading'].includes(j.status));
  useEffect(() => {
    if (!activeJobs) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [activeJobs]);
  useEffect(() => { savePreference('pv-layout', layout); }, [layout]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 7000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    const keys = e => {
      if (document.querySelector('dialog[open]') || e.target.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { setSelected(new Set()); setSelectMode(false); setMobileNav(false); }
    };
    window.addEventListener('keydown', keys); return () => window.removeEventListener('keydown', keys);
  }, []);
  useEffect(() => { setVisibleCount(60); setSelected(new Set()); setViewer(-1); }, [query, sort, type, route.view, route.album]);
  const live = useMemo(() => library.items.filter(i => !i.trashedAt), [library.items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('pl');
    return library.items.filter(i => {
      if (route.view === 'trash' ? !i.trashedAt : i.trashedAt) return false;
      if (route.album && i.album !== route.album) return false;
      if (route.view === 'videos' && i.kind !== 'video') return false;
      if (route.view === 'favorites' && !i.favorite) return false;
      if (type !== 'all' && i.kind !== type) return false;
      return !q || `${i.name} ${i.album}`.toLocaleLowerCase('pl').includes(q);
    }).sort((a,b) => sort === 'name' ? a.name.localeCompare(b.name, 'pl') : (sort === 'oldest' ? 1 : -1) * (new Date(a.createdAt || 0) - new Date(b.createdAt || 0)) || a.name.localeCompare(b.name, 'pl'));
  }, [library.items, query, route, sort, type]);
  const albums = useMemo(() => library.albums.map(name => {
    const items = live.filter(i => i.album === name).sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return { name, items, cover:items.find(i => i.thumbnailUrl || i.kind === 'image') || items[0] };
  }), [library.albums, live]);
  const shownAlbums = albums.filter(a => a.name.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl')));
  const totalSize = library.items.reduce((sum,i) => sum + i.size, 0), videoSize = library.items.filter(i => i.kind === 'video').reduce((n,i) => n + i.size, 0);
  const groups = useMemo(() => {
    const data = new Map();
    filtered.slice(0,visibleCount).forEach(item => {
      const key = sort === 'name' ? 'Pliki' : month(item.createdAt);
      if (!data.has(key)) data.set(key, []); data.get(key).push(item);
    }); return [...data];
  }, [filtered, visibleCount, sort]);
  function go(view, album = null) { navigate(view, album); setQuery(''); setType('all'); setSelectMode(false); setSelected(new Set()); setMobileNav(false); }
  function notify(message, error = false) { setToast({ message, error }); }
  function toggleSelect(item) { setSelectMode(true); setSelected(previous => { const next = new Set(previous); next.has(item.blobName) ? next.delete(item.blobName) : next.add(item.blobName); return next; }); }
  async function favorite(item) {
    if (busy) return; setBusy(true);
    try { await api('updateMedia', { method:'PATCH', body:{ blobName:item.blobName, favorite:!item.favorite } }); library.patch(item.blobName, { favorite:!item.favorite }); if (route.view === 'favorites' && item.favorite) setViewer(-1); }
    catch (error) { notify(error.message, true); } finally { setBusy(false); }
  }
  async function download(item) {
    try { const link = await api('getMediaLink', { method:'POST', body:{ blobName:item.blobName, download:true } }); const anchor = document.createElement('a'); anchor.href = link.url; anchor.download = item.name; anchor.rel = 'noreferrer'; document.body.appendChild(anchor); anchor.click(); anchor.remove(); }
    catch (error) { notify(error.message, true); }
  }
  function ask(action, items = filtered.filter(i => selected.has(i.blobName))) {
    if (!items.length) return;
    setViewer(-1); setDialogError(''); setDialog({ kind:'batch', action, items });
  }
  async function batch(action, items) {
    setBusy(true); setDialogError('');
    const results = await mapSettled(items, 3, async item => {
      if (action === 'restore' || action === 'favorite') {
        await api('updateMedia', { method:'PATCH', body:{ blobName:item.blobName, ...(action === 'restore' ? { restore:true } : { favorite:true }) } });
        library.patch(item.blobName, action === 'restore' ? { trashedAt:null } : { favorite:true });
      } else {
        await api('deletePhoto', { method:'DELETE', body:{ blobName:item.blobName, permanent:action === 'permanent' } });
        library.patch(item.blobName, action === 'permanent' ? null : { trashedAt:new Date().toISOString() });
      }
    });
    const failures = items.filter((_,i) => results[i].status === 'rejected');
    setSelected(new Set(failures.map(i => i.blobName))); setBusy(false); setDialog(null);
    if (!failures.length) { setSelectMode(false); notify(action === 'restore' ? `Przywrócono: ${items.length}.` : action === 'favorite' ? `Dodano do ulubionych: ${items.length}.` : action === 'permanent' ? `Trwale usunięto: ${items.length}.` : `Przeniesiono do kosza: ${items.length}.`); }
    else notify(`Zapisano ${items.length - failures.length} z ${items.length} zmian. Pozostałe pliki są nadal zaznaczone. ${results.find(r => r.status === 'rejected').reason.message}`, true);
  }
  async function clearAlbum() {
    setBusy(true); setDialogError(''); let cursor = null, moved = 0;
    try { do { const result = await api('deleteEvent', { method:'DELETE', body:{ event:route.album, cursor } }); moved += result.moved; cursor = result.nextCursor; } while (cursor); setDialog(null); notify(`Przeniesiono ${moved} plików do kosza. Album pozostaje w bibliotece.`); }
    catch (error) { setDialogError(error.message); } finally { setBusy(false); library.refresh(); }
  }
  async function createAlbum(e) {
    e.preventDefault(); setBusy(true); setDialogError('');
    try { const name = newAlbum.trim().normalize('NFC'); await api('createEvent', { method:'POST', body:{ event:name } }); setDialog(null); setNewAlbum(''); await library.refresh(); go('library',name); notify('Album gotowy. Dodaj pierwsze wspomnienia.'); }
    catch (error) { setDialogError(error.message); } finally { setBusy(false); }
  }
  async function logout() { try { await api('authLogout', { method:'POST', body:{} }); onLogout(); } catch (error) { notify(error.message,true); } }
  function startUpload(files, album) {
    const result = queue.add(files, album);
    if (!result.added) return { error:result.errors.length ? 'Nie dodano plików. Sprawdź format, rozmiar i limit 500 pozycji w kolejce.' : 'Te pliki są już w kolejce.' };
    setUpload(null); notify(`Dodano do kolejki: ${result.added}.${result.errors.length ? ` Pominięto ${result.errors.length}: nieobsługiwany format lub rozmiar.` : ''}`, !!result.errors.length);
  }
  const currentTitle = route.album || TITLES[route.view];
  const nav = [ ['library','grid','Wszystkie wspomnienia',live.length], ['albums','folder','Albumy',albums.length], ['videos','film','Filmy',live.filter(i => i.kind === 'video').length], ['favorites','heart','Ulubione',live.filter(i => i.favorite).length] ];
  return <div className="app-shell" onDragOver={e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); if (!upload) setDrag(true); } }} onDragLeave={e => { if (!e.relatedTarget) setDrag(false); }} onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) setUpload({ files:[...e.dataTransfer.files], album:route.album }); }}>
    <a className="skip-link" href="#main-content">{'Przejdź do zawartości'}</a>
    {mobileNav && <button className="nav-scrim" aria-label="Zamknij menu" onClick={() => setMobileNav(false)}/>}
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`} aria-label="Menu biblioteki"><button className="brand" onClick={() => go('library')}><span className="brand-mark"><Icon name="vault" size={23}/></span><span>photo<span className="brand-light">vault</span><small>{'NASZA PRZESTRZEŃ'}</small></span></button>
      <div className="workspace"><span className="workspace-avatar"><Icon name="heart" size={18}/></span><span><strong>Dla nas</strong><small><span className="status-dot"/>Prywatna biblioteka</small></span><Icon name="lock" size={14}/></div>
      <span className="nav-label">BIBLIOTEKA</span><nav>{nav.map(([view,icon,label,count]) => <button key={view} className={`nav-item ${route.view === view && !route.album ? 'active' : ''}`} onClick={() => go(view)} aria-current={route.view === view && !route.album ? 'page' : undefined}><Icon name={icon} size={19}/><span>{label}</span><small>{count}</small></button>)}</nav>
      <div className="nav-section-heading"><span className="nav-label">ALBUMY</span><IconButton icon="plus" label="Nowy album" onClick={() => { setDialogError(''); setDialog({ kind:'new' }); }}/></div><nav className="album-nav">{albums.slice(0,6).map((album,i) => <button key={album.name} className={`nav-item ${route.album === album.name ? 'active' : ''}`} onClick={() => go('library', album.name)}><span className={`album-dot dot-${i % 4}`}/><span>{album.name}</span></button>)}{!albums.length && <p className="nav-empty">{'Tutaj pojawią się Wasze albumy.'}</p>}{albums.length > 6 && <button className="nav-more" onClick={() => go('albums')}>{'Zobacz wszystkie'}<Icon name="right" size={14}/></button>}</nav>
      <div className="sidebar-bottom"><nav><button className={`nav-item ${route.view === 'trash' ? 'active' : ''}`} onClick={() => go('trash')}><Icon name="trash" size={19}/><span>Kosz</span><small>{library.items.length - live.length}</small></button><button className={`nav-item ${route.view === 'settings' ? 'active' : ''}`} onClick={() => go('settings')}><Icon name="settings" size={19}/><span>Ustawienia</span></button></nav>
        <div className="storage-card"><div><Icon name="cloud" size={18}/><span>Wasze pliki</span><strong>{bytes(totalSize)}</strong></div><div className="storage-bar" title="Udział zdjęć i filmów w zajętej przestrzeni; to nie limit pojemności" aria-hidden="true"><span style={{ width:totalSize ? `${100 - videoSize / totalSize * 100}%` : '0%' }}/></div><small>{'Rozmiar oryginałów, razem z koszem'}</small></div>
        <div className="user-card"><span className="user-avatar">{user.displayName.slice(0,1).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>{'Wspólna przestrzeń'}</small></span><IconButton icon="logout" label="Wyloguj" onClick={() => activeJobs ? (setDialogError(''),setDialog({ kind:'logout' })) : logout()}/></div>
      </div>
    </aside>
    <div className="main-shell"><header className="topbar"><IconButton icon="menu" label="Otwórz menu" className="mobile-menu" onClick={() => setMobileNav(true)}/><div className="breadcrumbs"><span>Biblioteka</span><Icon name="right" size={13}/><strong>{route.album ? 'Album' : TITLES[route.view]}</strong></div><div className="topbar-right"><span className="privacy-label"><Icon name="lock" size={14}/>Tylko dla Was</span><IconButton icon={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}/></div></header>
      <main id="main-content" className="content">
        <div className="page-heading"><div><span className="eyebrow">{route.album ? 'WSPÓLNY ALBUM' : route.view === 'trash' ? 'NIC POCHOPNIE' : 'WASZA MAŁA KOLEKCJA'}</span><h1>{currentTitle}</h1><p>{route.view === 'trash' ? 'Usunięte pliki czekają tutaj, aż zdecydujecie co dalej.' : route.view === 'settings' ? 'Prosto, prywatnie i po Waszemu.' : route.view === 'favorites' ? 'Chwile, do których chcecie wracać najczęściej.' : route.view === 'albums' ? 'Każda historia zasługuje na swoje miejsce.' : route.view === 'videos' ? 'Wspomnienia, które wciąż są w ruchu.' : 'Wielkie podróże i małe momenty. Wszystko tutaj.'}</p></div>
          {!['trash','settings'].includes(route.view) && <div className="heading-actions">{route.view === 'albums' && <button className="button" onClick={() => { setDialogError(''); setDialog({ kind:'new' }); }}><Icon name="plus"/>Nowy album</button>}<button className="button primary" onClick={() => setUpload({ album:route.album })}><Icon name="plus"/>{'Dodaj wspomnienia'}</button></div>}
        </div>
        {library.error && <div className="alert error" role="alert"><span>{library.error}</span><button className="text-button" onClick={library.refresh}>{'Spróbuj ponownie'}</button></div>}
        {route.view === 'settings' ? <section className="settings-grid"><div className="setting-card"><span className="setting-icon"><Icon name="heart" size={24}/></span><h2>{'Jedna biblioteka, Was dwoje'}</h2><p>{'Oboje możecie dodawać, przeglądać i usuwać pliki. Albumy, ulubione i kosz są wspólne.'}</p><dl><dt>Twoje konto</dt><dd>{user.username}</dd><dt>Sesja do</dt><dd>{date(user.expiresAt)}</dd><dt>Przechowywanie</dt><dd>Azure Blob Storage</dd></dl></div>
          <div className="setting-card"><span className="setting-icon"><Icon name="sun" size={24}/></span><h2>{'Twój widok'}</h2><p>{'Motyw jest zapisywany tylko w tej przeglądarce.'}</p><div className="theme-picker"><button className={`theme-option ${theme === 'light' ? 'active' : ''}`} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Icon name="sun" size={25}/>Jasny</button><button className={`theme-option ${theme === 'dark' ? 'active' : ''}`} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Icon name="moon" size={25}/>Ciemny</button></div></div>
          <div className="setting-card"><span className="setting-icon"><Icon name="cloud" size={24}/></span><h2>{'Pliki bez niespodzianek'}</h2><dl><dt>{'Limit pojedynczego pliku'}</dt><dd>{bytes(limits.maxUploadBytes)}</dd><dt>{'Rozmiar oryginałów'}</dt><dd>{bytes(totalSize)}</dd><dt>W koszu</dt><dd>{bytes(library.items.filter(i => i.trashedAt).reduce((s,i) => s + i.size,0))}</dd></dl><p>{'Kosz nie opróżnia się automatycznie. Miniatury i ewentualne wersje zapasowe Azure mogą zajmować dodatkowe miejsce.'}</p></div>
          <div className="setting-card"><span className="setting-icon"><Icon name="info" size={24}/></span><h2>{'Dobrze wiedzieć'}</h2><p>{'Nie zmieniamy jakości oryginałów. Dostępność podglądu HEIC, MOV i HEVC zależy od przeglądarki. Plik można zawsze pobrać.'}</p><p>{'Przesyłanie działa, dopóki karta jest otwarta. Telefon może je wstrzymać po zablokowaniu ekranu.'}</p><p>{'Ta aplikacja nie zastępuje niezależnej kopii zapasowej.'}</p></div>
        </section> : <>
          <div className="library-summary"><div className="summary-pills"><span><Icon name="photo" size={16}/>{counted((route.album ? live.filter(i => i.album === route.album) : live).filter(i => i.kind === 'image').length, 'zdjęcie', 'zdjęcia', 'zdjęć')}</span><span><Icon name="film" size={16}/>{counted((route.album ? live.filter(i => i.album === route.album) : live).filter(i => i.kind === 'video').length, 'film', 'filmy', 'filmów')}</span>{!route.album && <span><Icon name="folder" size={16}/>{counted(albums.length, 'album', 'albumy', 'albumów')}</span>}</div><button className="sync-status" onClick={library.refresh} disabled={library.loading} title="Odśwież bibliotekę"><Icon name="refresh" size={14} className={library.loading ? 'spinning' : ''}/>{library.loading ? `Synchronizowanie${library.scanned ? ` (${library.scanned})` : '...'}` : 'Odśwież'}</button></div>
          {route.view === 'trash' && <div className="trash-note"><Icon name="info" size={18}/>{'Pliki w koszu nadal zajmują miejsce. Możesz je przywrócić albo trwale usunąć. Nic nie znika automatycznie.'}</div>}
          <div className="library-toolbar"><div className="search-field"><Icon name="search" size={19}/><input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder={route.view === 'albums' ? 'Szukaj albumu...' : 'Szukaj plików lub albumów...'} aria-label="Szukaj w bibliotece"/><kbd>/</kbd>{query && <IconButton icon="x" label="Wyczyść wyszukiwanie" onClick={() => setQuery('')}/>}</div>
            {route.view !== 'albums' && <div className="toolbar-options"><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sortowanie"><option value="newest">Najnowsze</option><option value="oldest">Najstarsze</option><option value="name">Nazwa A-Z</option></select><div className="layout-switch" aria-label="Układ plików"><IconButton icon="grid" label="Widok siatki" className={layout === 'grid' ? 'active' : ''} aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}/><IconButton icon="list" label="Widok listy" className={layout === 'list' ? 'active' : ''} aria-pressed={layout === 'list'} onClick={() => setLayout('list')}/></div></div>}
          </div>
          {route.view !== 'albums' && <div className="filter-row"><div className="filter-tabs">{(route.view === 'videos' ? [['all','Wszystkie filmy']] : [['all','Wszystko'],['image','Zdjęcia'],['video','Filmy']]).map(([value,label]) => <button key={value} className={type === value ? 'active' : ''} onClick={() => setType(value)} aria-pressed={type === value}>{label}</button>)}</div><div className="filter-actions"><span>{counted(filtered.length, 'plik', 'pliki', 'plików')}</span><button className={`text-button ${selectMode ? 'active' : ''}`} onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }} disabled={busy}>{selectMode ? 'Anuluj wybieranie' : 'Wybierz'}</button>{route.album && <IconButton icon="trash" label="Przenieś zawartość albumu do kosza" disabled={busy || activeJobs} onClick={() => { setDialogError(''); setDialog({ kind:'album' }); }}/>}</div></div>}
          {selectMode && <div className="selection-bar"><label><input type="checkbox" checked={filtered.length > 0 && filtered.every(i => selected.has(i.blobName))} disabled={busy || !filtered.length} onChange={e => setSelected(e.target.checked ? new Set(filtered.map(i => i.blobName)) : new Set())}/>{selected.size} zaznaczonych</label><div>{route.view === 'trash' ? <><button className="button small" disabled={busy || !selected.size} onClick={() => batch('restore',filtered.filter(i => selected.has(i.blobName)))}><Icon name="restore" size={16}/>{'Przywróć'}</button><button className="button small danger-outline" disabled={busy || !selected.size} onClick={() => ask('permanent')}><Icon name="trash" size={16}/>{'Usuń trwale'}</button></> : <><button className="button small" disabled={busy || !selected.size} onClick={() => batch('favorite',filtered.filter(i => selected.has(i.blobName)))}><Icon name="heart" size={16}/>Ulubione</button><button className="button small" disabled={busy || !selected.size} onClick={() => ask('trash')}><Icon name="trash" size={16}/>Do kosza</button></>}{busy && <span className="spinner"/>}</div></div>}
          {library.loading && !library.items.length && !library.albums.length ? <div className="skeleton-grid" aria-label="Wczytywanie biblioteki">{Array.from({ length:8 },(_,i) => <div className="skeleton" key={i}/>)}</div> : route.view === 'albums' ? <div className="album-grid">{shownAlbums.map((album,i) => <button key={album.name} className="album-card" onClick={() => go('library',album.name)}><div className={`album-cover cover-${i % 4}`}>{album.cover ? <Preview item={album.cover}/> : <Icon name="folder" size={48}/>}<span className="album-cover-badge"><Icon name="folder" size={15}/></span></div><div className="album-caption"><h3>{album.name}</h3><span>{album.items.length ? counted(album.items.length, 'plik', 'pliki', 'plików') : 'Jeszcze bez wspomnień'}</span><Icon name="right" size={17}/></div></button>)}<button className="new-album-card" onClick={() => { setDialogError(''); setDialog({ kind:'new' }); }}><span><Icon name="plus" size={25}/></span><strong>Nowy album</strong><small>{'Miejsce na kolejną historię'}</small></button>{query && !shownAlbums.length && <p className="muted">{'Nie znaleziono albumu o tej nazwie.'}</p>}</div> : !filtered.length ? <div className="empty-state"><span className="empty-icon"><Icon name={query ? 'search' : route.view === 'trash' ? 'trash' : route.view === 'favorites' ? 'heart' : 'photo'} size={37}/></span><h2>{query ? 'Nie znaleziono wspomnień' : route.view === 'trash' ? 'Kosz jest pusty' : route.view === 'favorites' ? 'Wasze ulubione chwile, w jednym miejscu' : 'Ta historia dopiero się zaczyna'}</h2><p>{query ? 'Spróbuj innej nazwy pliku lub albumu.' : route.view === 'trash' ? 'Pliki, które usuniecie z biblioteki, pojawią się tutaj.' : route.view === 'favorites' ? 'Kliknij serduszko przy zdjęciu lub filmie, aby zapisać je tutaj.' : 'Dodaj pierwsze zdjęcia i filmy. Resztę ułożycie po swojemu.'}</p>{!query && !['trash','favorites'].includes(route.view) && <button className="button primary" onClick={() => setUpload({ album:route.album })}><Icon name="plus"/>{'Dodaj wspomnienia'}</button>}{query && <button className="button" onClick={() => setQuery('')}>{'Wyczyść wyszukiwanie'}</button>}</div> : <div className="media-groups">{groups.map(([label,items]) => <section className="media-group" key={label}><h2>{label}<span>{items.length}</span></h2><div className={layout === 'grid' ? 'media-grid' : 'media-list'}>{items.map(item => { const props = { item, selected:selected.has(item.blobName), onSelect:() => toggleSelect(item), onOpen:() => setViewer(filtered.findIndex(i => i.blobName === item.blobName)), onFavorite:() => favorite(item), busy }; return layout === 'grid' ? <MediaCard key={item.blobName} {...props} selectMode={selectMode}/> : <MediaRow key={item.blobName} {...props}/>; })}</div></section>)}{filtered.length > visibleCount && <div className="load-more"><button className="button" onClick={() => setVisibleCount(n => n + 60)}>{`Pokaż kolejne (${filtered.length - visibleCount})`}</button></div>}</div>}
        </>}
        <footer className="content-footer"><span><Icon name="lock" size={13}/>{'Wasze wspomnienia. Tylko dla Was.'}</span><span>photoVault</span></footer>
      </main>
    </div>
    <UploadPanel jobs={jobs} queue={queue}/>
    {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role={toast.error ? 'alert' : 'status'}><Icon name={toast.error ? 'info' : 'check'} size={20}/><span>{toast.message}</span><IconButton icon="x" label="Zamknij komunikat" onClick={() => setToast(null)}/></div>}
    {drag && !upload && <div className="global-drop"><Icon name="upload" size={52}/><h2>{'Upuść swoje wspomnienia'}</h2><p>{'W następnym kroku wybierzesz album.'}</p></div>}
    {upload && <UploadDialog albums={library.albums} initialAlbum={upload.album} initialFiles={upload.files} maxBytes={limits.maxUploadBytes} onClose={() => setUpload(null)} onUpload={startUpload}/>}
    {viewer >= 0 && filtered[viewer] && <Lightbox items={filtered} index={viewer} setIndex={setViewer} onClose={() => setViewer(-1)} onFavorite={favorite} onDownload={download} onTrash={item => ask('trash',[item])} busy={busy}/>}
    {dialog?.kind === 'new' && <Modal title="Nowy album" onClose={() => setDialog(null)} busy={busy}><form onSubmit={createAlbum}><p className="muted">{'Nadaj nazwę kolejnemu rozdziałowi Waszej historii. Pliki możesz dodać za chwilę.'}</p><label htmlFor="album-name">Nazwa albumu</label><input id="album-name" value={newAlbum} onChange={e => setNewAlbum(e.target.value)} maxLength={120} autoFocus required placeholder="np. Lato nad morzem"/>{dialogError && <p className="alert error" role="alert">{dialogError}</p>}<div className="modal-footer"><button className="button ghost" type="button" disabled={busy} onClick={() => setDialog(null)}>Anuluj</button><button className="button primary" disabled={busy}>{busy ? 'Tworzenie...' : 'Utwórz album'}</button></div></form></Modal>}
    {dialog && ['batch','album','logout'].includes(dialog.kind) && <Modal title={dialog.kind === 'logout' ? 'Trwa przesyłanie' : dialog.kind === 'album' ? 'Przenieś zawartość albumu?' : dialog.action === 'permanent' ? 'Trwale usunąć pliki?' : 'Przenieść do kosza?'} busy={busy} onClose={() => setDialog(null)}><div className="confirmation-copy"><span className="confirm-icon"><Icon name={dialog.kind === 'logout' ? 'upload' : 'trash'} size={29}/></span><p>{dialog.kind === 'logout' ? 'Wylogowanie przerwie aktywne przesyłanie. Pliki już zapisane pozostaną w bibliotece.' : dialog.kind === 'album' ? `Pliki z albumu „${route.album}” trafią do wspólnego kosza. Możesz je później przywrócić; sam album pozostanie.` : dialog.action === 'permanent' ? `Liczba plików do usunięcia: ${dialog.items.length}. Znikną dla Was obojga. Tej operacji nie cofniesz w aplikacji.` : `Liczba plików przenoszonych do wspólnego kosza: ${dialog.items.length}. Oboje możecie je później przywrócić.`}</p></div>{dialogError && <div className="alert error" role="alert">{dialogError}</div>}<div className="modal-footer"><button className="button ghost" disabled={busy} onClick={() => setDialog(null)}>Anuluj</button><button className={`button ${dialog.action === 'permanent' ? 'danger' : 'primary'}`} disabled={busy} onClick={() => dialog.kind === 'logout' ? logout() : dialog.kind === 'album' ? clearAlbum() : batch(dialog.action,dialog.items)}>{busy ? <><span className="spinner"/>Zapisywanie...</> : dialog.kind === 'logout' ? 'Przerwij i wyloguj' : dialog.action === 'permanent' ? 'Usuń trwale' : 'Przenieś do kosza'}</button></div></Modal>}
  </div>;
}
