import React, { useEffect, useRef, useState } from 'react';
import Icon, { IconButton } from './Icon.jsx';
import Modal from './Modal.jsx';
import { api } from '../lib/api.js';
import { bytes, date, extension } from '../lib/format.js';
export default function Lightbox({ items, index, setIndex, onClose, onFavorite, onDownload, onTrash, busy }) {
  const item = items[index];
  const [info, setInfo] = useState(false), [zoom, setZoom] = useState(false), [error, setError] = useState(''), [url, setUrl] = useState(null);
  const touch = useRef(null);
  useEffect(() => {
    if (!item) return;
    setZoom(false); setError(''); setUrl(null);
    const controller = new AbortController();
    api('getMediaLink', { method:'POST', body:{ blobName:item.blobName }, signal:controller.signal }).then(link => setUrl(link.url)).catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    return () => controller.abort();
  }, [item?.blobName]);
  useEffect(() => {
    const key = e => { if (e.target.tagName === 'VIDEO' || e.altKey || e.ctrlKey || e.metaKey) return; if (e.key === 'ArrowRight') { e.preventDefault(); setIndex(i => Math.min(items.length - 1, i + 1)); } if (e.key === 'ArrowLeft') { e.preventDefault(); setIndex(i => Math.max(0, i - 1)); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [items.length, setIndex]);
  if (!item) return null;
  return <Modal title={item.name} onClose={onClose} className="lightbox">
    <div className="lightbox-toolbar"><span className="lightbox-counter">{index + 1}<span> / {items.length}</span></span><div className="lightbox-actions">
      {!item.trashedAt && <button className={`icon-button ${item.favorite ? 'is-favorite' : ''}`} aria-label="Ulubione" aria-pressed={item.favorite} disabled={busy} onClick={() => onFavorite(item)}><Icon name="heart" filled={item.favorite}/></button>}
      {item.kind === 'image' && <IconButton icon="zoom" label={zoom ? 'Oddal' : 'Powiększ'} aria-pressed={zoom} onClick={() => setZoom(!zoom)}/>}
      <IconButton icon="download" label="Pobierz oryginalny plik" onClick={() => onDownload(item)}/><IconButton icon="info" label="Informacje o pliku" aria-pressed={info} onClick={() => setInfo(!info)}/>
      {!item.trashedAt && <IconButton icon="trash" label="Przenieś do kosza" disabled={busy} onClick={() => onTrash(item)}/>}
    </div></div>
    <div className={`lightbox-body ${info ? 'with-info' : ''}`}><div className="lightbox-stage"
      onPointerDown={e => { if (e.pointerType === 'touch' && item.kind === 'image' && !zoom) touch.current = e.clientX; }}
      onPointerUp={e => { if (touch.current !== null) { const delta = e.clientX - touch.current; if (Math.abs(delta) > 70) setIndex(i => Math.max(0, Math.min(items.length - 1, i + (delta < 0 ? 1 : -1)))); touch.current = null; } }}>
      {!url && !error ? <div className="viewer-error" role="status"><span className="spinner"/><p>Wczytywanie podglądu...</p></div> : error ? <div className="viewer-error"><Icon name={item.kind === 'video' ? 'film' : 'photo'} size={48}/><h3>{'Nie można wyświetlić podglądu'}</h3><p>{error}</p><button className="button" onClick={() => onDownload(item)}><Icon name="download"/>Pobierz oryginał</button></div>
        : item.kind === 'video' ? <video key={item.blobName} src={url} controls playsInline preload="metadata" onError={() => setError('Przeglądarka może nie obsługiwać kodeka tego filmu. Pobierz oryginał lub przekonwertuj go do MP4 (H.264 + AAC).')}/>
        : <img src={url} alt={item.name} className={zoom ? 'zoomed' : ''} referrerPolicy="no-referrer" onError={() => setError('Ten format nie ma podglądu w tej przeglądarce albo link wygasł. Oryginalny plik pozostaje w bibliotece.')}/>}
      <IconButton icon="left" label="Poprzedni plik" className="lightbox-prev" disabled={index === 0} onClick={() => setIndex(i => i - 1)}/><IconButton icon="right" label="Następny plik" className="lightbox-next" disabled={index === items.length - 1} onClick={() => setIndex(i => i + 1)}/>
    </div>{info && <aside className="file-info"><h3>Informacje</h3><dl><dt>Nazwa pliku</dt><dd>{item.name}</dd><dt>Album</dt><dd>{item.album}</dd><dt>Rozmiar</dt><dd>{bytes(item.size)}</dd><dt>Format</dt><dd>{extension(item.name)}</dd><dt>Dodano</dt><dd>{date(item.createdAt)}</dd>{item.trashedAt && <><dt>W koszu od</dt><dd>{date(item.trashedAt)}</dd></>}</dl><p>{'Oryginalna jakość. Bez kompresji pliku.'}</p></aside>}</div>
    <footer className="lightbox-footer"><span>{item.album}</span><span>{item.kind === 'video' ? 'Film' : 'Zdjęcie'} &middot; {bytes(item.size)}</span></footer>
  </Modal>;
}
