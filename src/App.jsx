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
const TITLES = { library:'All memories', albums:'Your albums', videos:'Videos', favorites:'Favorites', trash:'Trash', settings:'Your space' };
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
    const expired = () => { setSession(null); updateSession(null); setAuthError('Your session has expired. Please sign in again.'); };
    window.addEventListener('pv:session-expired', expired);
    return () => { controller.abort(); window.removeEventListener('pv:session-expired', expired); };
  }, [applySession]);
  if (checking) return <div className="boot-screen"><span className="brand-mark"><Icon name="vault" size={28}/></span><h1>photovault</h1><p><span className="spinner"/>{'Opening your space...'}</p></div>;
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
    const q = query.trim().toLocaleLowerCase('en-GB');
    return library.items.filter(i => {
      if (route.view === 'trash' ? !i.trashedAt : i.trashedAt) return false;
      if (route.album && i.album !== route.album) return false;
      if (route.view === 'videos' && i.kind !== 'video') return false;
      if (route.view === 'favorites' && !i.favorite) return false;
      if (type !== 'all' && i.kind !== type) return false;
      return !q || `${i.name} ${i.album}`.toLocaleLowerCase('en-GB').includes(q);
    }).sort((a,b) => sort === 'name' ? a.name.localeCompare(b.name, 'en-GB') : (sort === 'oldest' ? 1 : -1) * (new Date(a.createdAt || 0) - new Date(b.createdAt || 0)) || a.name.localeCompare(b.name, 'en-GB'));
  }, [library.items, query, route, sort, type]);
  const albums = useMemo(() => library.albums.map(name => {
    const items = live.filter(i => i.album === name).sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return { name, items, cover:items.find(i => i.thumbnailUrl || i.kind === 'image') || items[0] };
  }), [library.albums, live]);
  const shownAlbums = albums.filter(a => a.name.toLocaleLowerCase('en-GB').includes(query.toLocaleLowerCase('en-GB')));
  const totalSize = library.items.reduce((sum,i) => sum + i.size, 0), videoSize = library.items.filter(i => i.kind === 'video').reduce((n,i) => n + i.size, 0);
  const groups = useMemo(() => {
    const data = new Map();
    filtered.slice(0,visibleCount).forEach(item => {
      const key = sort === 'name' ? 'Files' : month(item.createdAt);
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
    if (!failures.length) { setSelectMode(false); notify(action === 'restore' ? `Restored: ${items.length}.` : action === 'favorite' ? `Added to favorites: ${items.length}.` : action === 'permanent' ? `Permanently deleted: ${items.length}.` : `Moved to trash: ${items.length}.`); }
    else notify(`Saved ${items.length - failures.length} of ${items.length} changes. The remaining files are still selected. ${results.find(r => r.status === 'rejected').reason.message}`, true);
  }
  async function clearAlbum() {
    setBusy(true); setDialogError(''); let cursor = null, moved = 0;
    try { do { const result = await api('deleteEvent', { method:'DELETE', body:{ event:route.album, cursor } }); moved += result.moved; cursor = result.nextCursor; } while (cursor); setDialog(null); notify(`Moved ${moved} files to trash. The album remains in the library.`); }
    catch (error) { setDialogError(error.message); } finally { setBusy(false); library.refresh(); }
  }
  async function createAlbum(e) {
    e.preventDefault(); setBusy(true); setDialogError('');
    try { const name = newAlbum.trim().normalize('NFC'); await api('createEvent', { method:'POST', body:{ event:name } }); setDialog(null); setNewAlbum(''); await library.refresh(); go('library',name); notify('Album created. Add your first memories.'); }
    catch (error) { setDialogError(error.message); } finally { setBusy(false); }
  }
  async function logout() { try { await api('authLogout', { method:'POST', body:{} }); onLogout(); } catch (error) { notify(error.message,true); } }
  function startUpload(files, album) {
    const result = queue.add(files, album);
    if (!result.added) return { error:result.errors.length ? 'No files were added. Check the format, size, and the 500-item queue limit.' : 'These files are already in the queue.' };
    setUpload(null); notify(`Added to queue: ${result.added}.${result.errors.length ? ` Skipped ${result.errors.length}: unsupported format or size.` : ''}`, !!result.errors.length);
  }
  const currentTitle = route.album || TITLES[route.view];
  const nav = [ ['library','grid','All memories',live.length], ['albums','folder','Albums',albums.length], ['videos','film','Videos',live.filter(i => i.kind === 'video').length], ['favorites','heart','Favorites',live.filter(i => i.favorite).length] ];
  return <div className="app-shell" onDragOver={e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); if (!upload) setDrag(true); } }} onDragLeave={e => { if (!e.relatedTarget) setDrag(false); }} onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) setUpload({ files:[...e.dataTransfer.files], album:route.album }); }}>
    <a className="skip-link" href="#main-content">{'Skip to content'}</a>
    {mobileNav && <button className="nav-scrim" aria-label="Close menu" onClick={() => setMobileNav(false)}/>}
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`} aria-label="Library menu"><button className="brand" onClick={() => go('library')}><span className="brand-mark"><Icon name="vault" size={23}/></span><span>photo<span className="brand-light">vault</span><small>{'OUR SPACE'}</small></span></button>
      <div className="workspace"><span className="workspace-avatar"><Icon name="heart" size={18}/></span><span><strong>For us</strong><small><span className="status-dot"/>Private library</small></span><Icon name="lock" size={14}/></div>
      <span className="nav-label">LIBRARY</span><nav>{nav.map(([view,icon,label,count]) => <button key={view} className={`nav-item ${route.view === view && !route.album ? 'active' : ''}`} onClick={() => go(view)} aria-current={route.view === view && !route.album ? 'page' : undefined}><Icon name={icon} size={19}/><span>{label}</span><small>{count}</small></button>)}</nav>
      <div className="nav-section-heading"><span className="nav-label">ALBUMS</span><IconButton icon="plus" label="New album" onClick={() => { setDialogError(''); setDialog({ kind:'new' }); }}/></div><nav className="album-nav">{albums.slice(0,6).map((album,i) => <button key={album.name} className={`nav-item ${route.album === album.name ? 'active' : ''}`} onClick={() => go('library', album.name)}><span className={`album-dot dot-${i % 4}`}/><span>{album.name}</span></button>)}{!albums.length && <p className="nav-empty">{'Your albums will appear here.'}</p>}{albums.length > 6 && <button className="nav-more" onClick={() => go('albums')}>{'View all'}<Icon name="right" size={14}/></button>}</nav>
      <div className="sidebar-bottom"><nav><button className={`nav-item ${route.view === 'trash' ? 'active' : ''}`} onClick={() => go('trash')}><Icon name="trash" size={19}/><span>Trash</span><small>{library.items.length - live.length}</small></button><button className={`nav-item ${route.view === 'settings' ? 'active' : ''}`} onClick={() => go('settings')}><Icon name="settings" size={19}/><span>Settings</span></button></nav>
        <div className="storage-card"><div><Icon name="cloud" size={18}/><span>Your files</span><strong>{bytes(totalSize)}</strong></div><div className="storage-bar" title="Share of photos and videos in used space; this is not a storage limit" aria-hidden="true"><span style={{ width:totalSize ? `${100 - videoSize / totalSize * 100}%` : '0%' }}/></div><small>{'Original files, including trash'}</small></div>
        <div className="user-card"><span className="user-avatar">{user.displayName.slice(0,1).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>{'Shared space'}</small></span><IconButton icon="logout" label="Sign out" onClick={() => activeJobs ? (setDialogError(''),setDialog({ kind:'logout' })) : logout()}/></div>
      </div>
    </aside>
    <div className="main-shell"><header className="topbar"><IconButton icon="menu" label="Open menu" className="mobile-menu" onClick={() => setMobileNav(true)}/><div className="breadcrumbs"><span>Library</span><Icon name="right" size={13}/><strong>{route.album ? 'Album' : TITLES[route.view]}</strong></div><div className="topbar-right"><span className="privacy-label"><Icon name="lock" size={14}/>Only for you two</span><IconButton icon={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? 'Light theme' : 'Dark theme'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}/></div></header>
      <main id="main-content" className="content">
        <div className="page-heading"><div><span className="eyebrow">{route.album ? 'SHARED ALBUM' : route.view === 'trash' ? 'TAKE YOUR TIME' : 'YOUR LITTLE COLLECTION'}</span><h1>{currentTitle}</h1><p>{route.view === 'trash' ? 'Deleted files stay here until you decide what to do with them.' : route.view === 'settings' ? 'Simple, private, and yours.' : route.view === 'favorites' ? 'The moments you want to revisit most.' : route.view === 'albums' ? 'Every story deserves its own place.' : route.view === 'videos' ? 'Memories that are still in motion.' : 'Big trips and little moments. All in one place.'}</p></div>
          {!['trash','settings'].includes(route.view) && <div className="heading-actions">{route.view === 'albums' && <button className="button" onClick={() => { setDialogError(''); setDialog({ kind:'new' }); }}><Icon name="plus"/>New album</button>}<button className="button primary" onClick={() => setUpload({ album:route.album })}><Icon name="plus"/>{'Add memories'}</button></div>}
        </div>
        {library.error && <div className="alert error" role="alert"><span>{library.error}</span><button className="text-button" onClick={library.refresh}>{'Try again'}</button></div>}
        {route.view === 'settings' ? <section className="settings-grid"><div className="setting-card"><span className="setting-icon"><Icon name="heart" size={24}/></span><h2>{'One library, two of you'}</h2><p>{'Both of you can add, browse, and delete files. Albums, favorites, and trash are shared.'}</p><dl><dt>Your account</dt><dd>{user.username}</dd><dt>Session expires</dt><dd>{date(user.expiresAt)}</dd><dt>Storage</dt><dd>Azure Blob Storage</dd></dl></div>
          <div className="setting-card"><span className="setting-icon"><Icon name="sun" size={24}/></span><h2>{'Your view'}</h2><p>{'The theme is saved only in this browser.'}</p><div className="theme-picker"><button className={`theme-option ${theme === 'light' ? 'active' : ''}`} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Icon name="sun" size={25}/>Light</button><button className={`theme-option ${theme === 'dark' ? 'active' : ''}`} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Icon name="moon" size={25}/>Dark</button></div></div>
          <div className="setting-card"><span className="setting-icon"><Icon name="cloud" size={24}/></span><h2>{'Your files, no surprises'}</h2><dl><dt>{'Per-file limit'}</dt><dd>{bytes(limits.maxUploadBytes)}</dd><dt>{'Original file size'}</dt><dd>{bytes(totalSize)}</dd><dt>In trash</dt><dd>{bytes(library.items.filter(i => i.trashedAt).reduce((s,i) => s + i.size,0))}</dd></dl><p>{'Trash is not emptied automatically. Thumbnails and optional Azure backups may use additional space.'}</p></div>
          <div className="setting-card"><span className="setting-icon"><Icon name="info" size={24}/></span><h2>{'Good to know'}</h2><p>{'We never change the quality of the original files. HEIC, MOV, and HEVC preview support depends on the browser. You can always download the original file.'}</p><p>{'Uploads continue while this tab is open. A phone may pause them when the screen is locked.'}</p><p>{'This app is not a substitute for an independent backup.'}</p></div>
        </section> : <>
          <div className="library-summary"><div className="summary-pills"><span><Icon name="photo" size={16}/>{counted((route.album ? live.filter(i => i.album === route.album) : live).filter(i => i.kind === 'image').length, 'photo', 'photos', 'photos')}</span><span><Icon name="film" size={16}/>{counted((route.album ? live.filter(i => i.album === route.album) : live).filter(i => i.kind === 'video').length, 'video', 'videos', 'videos')}</span>{!route.album && <span><Icon name="folder" size={16}/>{counted(albums.length, 'album', 'albums', 'albums')}</span>}</div><button className="sync-status" onClick={library.refresh} disabled={library.loading} title="Refresh library"><Icon name="refresh" size={14} className={library.loading ? 'spinning' : ''}/>{library.loading ? `Syncing${library.scanned ? ` (${library.scanned})` : '...'}` : 'Refresh'}</button></div>
          {route.view === 'trash' && <div className="trash-note"><Icon name="info" size={18}/>{'Files in trash still use storage. You can restore or permanently delete them. Nothing disappears automatically.'}</div>}
          <div className="library-toolbar"><div className="search-field"><Icon name="search" size={19}/><input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder={route.view === 'albums' ? 'Search albums...' : 'Search files or albums...'} aria-label="Search library"/><kbd>/</kbd>{query && <IconButton icon="x" label="Clear search" onClick={() => setQuery('')}/>}</div>
            {route.view !== 'albums' && <div className="toolbar-options"><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">Name A-Z</option></select><div className="layout-switch" aria-label="File layout"><IconButton icon="grid" label="Grid view" className={layout === 'grid' ? 'active' : ''} aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}/><IconButton icon="list" label="List view" className={layout === 'list' ? 'active' : ''} aria-pressed={layout === 'list'} onClick={() => setLayout('list')}/></div></div>}
          </div>
          {route.view !== 'albums' && <div className="filter-row"><div className="filter-tabs">{(route.view === 'videos' ? [['all','All videos']] : [['all','All'],['image','Photos'],['video','Videos']]).map(([value,label]) => <button key={value} className={type === value ? 'active' : ''} onClick={() => setType(value)} aria-pressed={type === value}>{label}</button>)}</div><div className="filter-actions"><span>{counted(filtered.length, 'file', 'files', 'files')}</span><button className={`text-button ${selectMode ? 'active' : ''}`} onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }} disabled={busy}>{selectMode ? 'Cancel selection' : 'Wybierz'}</button>{route.album && <IconButton icon="trash" label="Move album contents to trash" disabled={busy || activeJobs} onClick={() => { setDialogError(''); setDialog({ kind:'album' }); }}/>}</div></div>}
          {selectMode && <div className="selection-bar"><label><input type="checkbox" checked={filtered.length > 0 && filtered.every(i => selected.has(i.blobName))} disabled={busy || !filtered.length} onChange={e => setSelected(e.target.checked ? new Set(filtered.map(i => i.blobName)) : new Set())}/>{selected.size} selected</label><div>{route.view === 'trash' ? <><button className="button small" disabled={busy || !selected.size} onClick={() => batch('restore',filtered.filter(i => selected.has(i.blobName)))}><Icon name="restore" size={16}/>{'Restore'}</button><button className="button small danger-outline" disabled={busy || !selected.size} onClick={() => ask('permanent')}><Icon name="trash" size={16}/>{'Delete permanently'}</button></> : <><button className="button small" disabled={busy || !selected.size} onClick={() => batch('favorite',filtered.filter(i => selected.has(i.blobName)))}><Icon name="heart" size={16}/>Favorites</button><button className="button small" disabled={busy || !selected.size} onClick={() => ask('trash')}><Icon name="trash" size={16}/>Move to trash</button></>}{busy && <span className="spinner"/>}</div></div>}
          {library.loading && !library.items.length && !library.albums.length ? <div className="skeleton-grid" aria-label="Loading library">{Array.from({ length:8 },(_,i) => <div className="skeleton" key={i}/>)}</div> : route.view === 'albums' ? <div className="album-grid">{shownAlbums.map((album,i) => <button key={album.name} className="album-card" onClick={() => go('library',album.name)}><div className={`album-cover cover-${i % 4}`}>{album.cover ? <Preview item={album.cover}/> : <Icon name="folder" size={48}/>}<span className="album-cover-badge"><Icon name="folder" size={15}/></span></div><div className="album-caption"><h3>{album.name}</h3><span>{album.items.length ? counted(album.items.length, 'file', 'files', 'files') : 'No memories yet'}</span><Icon name="right" size={17}/></div></button>)}<button className="new-album-card" onClick={() => { setDialogError(''); setDialog({ kind:'new' }); }}><span><Icon name="plus" size={25}/></span><strong>New album</strong><small>{'A place for your next story'}</small></button>{query && !shownAlbums.length && <p className="muted">{'No album with that name was found.'}</p>}</div> : !filtered.length ? <div className="empty-state"><span className="empty-icon"><Icon name={query ? 'search' : route.view === 'trash' ? 'trash' : route.view === 'favorites' ? 'heart' : 'photo'} size={37}/></span><h2>{query ? 'No memories found' : route.view === 'trash' ? 'Trash is empty' : route.view === 'favorites' ? 'Your favorite moments, all in one place' : 'This story is just beginning'}</h2><p>{query ? 'Try a different file or album name.' : route.view === 'trash' ? 'Files removed from the library will appear here.' : route.view === 'favorites' ? 'Click the heart on a photo or video to save it here.' : 'Add your first photos and videos. The rest is yours to organize.'}</p>{!query && !['trash','favorites'].includes(route.view) && <button className="button primary" onClick={() => setUpload({ album:route.album })}><Icon name="plus"/>{'Add memories'}</button>}{query && <button className="button" onClick={() => setQuery('')}>{'Clear search'}</button>}</div> : <div className="media-groups">{groups.map(([label,items]) => <section className="media-group" key={label}><h2>{label}<span>{items.length}</span></h2><div className={layout === 'grid' ? 'media-grid' : 'media-list'}>{items.map(item => { const props = { item, selected:selected.has(item.blobName), onSelect:() => toggleSelect(item), onOpen:() => setViewer(filtered.findIndex(i => i.blobName === item.blobName)), onFavorite:() => favorite(item), busy }; return layout === 'grid' ? <MediaCard key={item.blobName} {...props} selectMode={selectMode}/> : <MediaRow key={item.blobName} {...props}/>; })}</div></section>)}{filtered.length > visibleCount && <div className="load-more"><button className="button" onClick={() => setVisibleCount(n => n + 60)}>{`Show more (${filtered.length - visibleCount})`}</button></div>}</div>}
        </>}
        <footer className="content-footer"><span><Icon name="lock" size={13}/>{'Your memories. Only for you two.'}</span><span>photoVault</span></footer>
      </main>
    </div>
    <UploadPanel jobs={jobs} queue={queue}/>
    {toast && <div className={`toast ${toast.error ? 'error' : ''}`} role={toast.error ? 'alert' : 'status'}><Icon name={toast.error ? 'info' : 'check'} size={20}/><span>{toast.message}</span><IconButton icon="x" label="Close notification" onClick={() => setToast(null)}/></div>}
    {drag && !upload && <div className="global-drop"><Icon name="upload" size={52}/><h2>{'Drop your memories here'}</h2><p>{'You will choose an album in the next step.'}</p></div>}
    {upload && <UploadDialog albums={library.albums} initialAlbum={upload.album} initialFiles={upload.files} maxBytes={limits.maxUploadBytes} onClose={() => setUpload(null)} onUpload={startUpload}/>}
    {viewer >= 0 && filtered[viewer] && <Lightbox items={filtered} index={viewer} setIndex={setViewer} onClose={() => setViewer(-1)} onFavorite={favorite} onDownload={download} onTrash={item => ask('trash',[item])} busy={busy}/>}
    {dialog?.kind === 'new' && <Modal title="New album" onClose={() => setDialog(null)} busy={busy}><form onSubmit={createAlbum}><p className="muted">{'Give the next chapter of your story a name. You can add files in a moment.'}</p><label htmlFor="album-name">Album name</label><input id="album-name" value={newAlbum} onChange={e => setNewAlbum(e.target.value)} maxLength={120} autoFocus required placeholder="e.g. Summer by the sea"/>{dialogError && <p className="alert error" role="alert">{dialogError}</p>}<div className="modal-footer"><button className="button ghost" type="button" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Creating...' : 'Create album'}</button></div></form></Modal>}
    {dialog && ['batch','album','logout'].includes(dialog.kind) && <Modal title={dialog.kind === 'logout' ? 'Upload in progress' : dialog.kind === 'album' ? 'Move album contents to trash?' : dialog.action === 'permanent' ? 'Permanently delete files?' : 'Move to trash?'} busy={busy} onClose={() => setDialog(null)}><div className="confirmation-copy"><span className="confirm-icon"><Icon name={dialog.kind === 'logout' ? 'upload' : 'trash'} size={29}/></span><p>{dialog.kind === 'logout' ? 'Signing out will stop active uploads. Files already saved will remain in the library.' : dialog.kind === 'album' ? `Files from “${route.album}” will be moved to the shared trash. You can restore them later; the album itself will remain.` : dialog.action === 'permanent' ? `${dialog.items.length} files will be permanently deleted for both of you. This cannot be undone in the app.` : `${dialog.items.length} files will be moved to the shared trash. Either of you can restore them later.`}</p></div>{dialogError && <div className="alert error" role="alert">{dialogError}</div>}<div className="modal-footer"><button className="button ghost" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button className={`button ${dialog.action === 'permanent' ? 'danger' : 'primary'}`} disabled={busy} onClick={() => dialog.kind === 'logout' ? logout() : dialog.kind === 'album' ? clearAlbum() : batch(dialog.action,dialog.items)}>{busy ? <><span className="spinner"/>Saving...</> : dialog.kind === 'logout' ? 'Stop and sign out' : dialog.action === 'permanent' ? 'Delete permanently' : 'Move to trash'}</button></div></Modal>}
  </div>;
}
