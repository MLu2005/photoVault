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
      {!item.trashedAt && <button className={`icon-button ${item.favorite ? 'is-favorite' : ''}`} aria-label="Favorites" aria-pressed={item.favorite} disabled={busy} onClick={() => onFavorite(item)}><Icon name="heart" filled={item.favorite}/></button>}
      {item.kind === 'image' && <IconButton icon="zoom" label={zoom ? 'Zoom out' : 'Zoom in'} aria-pressed={zoom} onClick={() => setZoom(!zoom)}/>}
      <IconButton icon="download" label="Download original file" onClick={() => onDownload(item)}/><IconButton icon="info" label="File information" aria-pressed={info} onClick={() => setInfo(!info)}/>
      {!item.trashedAt && <IconButton icon="trash" label="Move to trash" disabled={busy} onClick={() => onTrash(item)}/>}
    </div></div>
    <div className={`lightbox-body ${info ? 'with-info' : ''}`}><div className="lightbox-stage"
      onPointerDown={e => { if (e.pointerType === 'touch' && item.kind === 'image' && !zoom) touch.current = e.clientX; }}
      onPointerUp={e => { if (touch.current !== null) { const delta = e.clientX - touch.current; if (Math.abs(delta) > 70) setIndex(i => Math.max(0, Math.min(items.length - 1, i + (delta < 0 ? 1 : -1)))); touch.current = null; } }}>
      {!url && !error ? <div className="viewer-error" role="status"><span className="spinner"/><p>Loading preview...</p></div> : error ? <div className="viewer-error"><Icon name={item.kind === 'video' ? 'film' : 'photo'} size={48}/><h3>{'Preview unavailable'}</h3><p>{error}</p><button className="button" onClick={() => onDownload(item)}><Icon name="download"/>Download original</button></div>
        : item.kind === 'video' ? <video key={item.blobName} src={url} controls playsInline preload="metadata" onError={() => setError('Your browser may not support this video codec. Download the original or convert it to MP4 (H.264 + AAC).')}/>
        : <img src={url} alt={item.name} className={zoom ? 'zoomed' : ''} referrerPolicy="no-referrer" onError={() => setError('This format cannot be previewed in this browser, or the link has expired. The original file remains in the library.')}/>}
      <IconButton icon="left" label="Previous file" className="lightbox-prev" disabled={index === 0} onClick={() => setIndex(i => i - 1)}/><IconButton icon="right" label="Next file" className="lightbox-next" disabled={index === items.length - 1} onClick={() => setIndex(i => i + 1)}/>
    </div>{info && <aside className="file-info"><h3>Information</h3><dl><dt>File name</dt><dd>{item.name}</dd><dt>Album</dt><dd>{item.album}</dd><dt>Size</dt><dd>{bytes(item.size)}</dd><dt>Format</dt><dd>{extension(item.name)}</dd><dt>Added</dt><dd>{date(item.createdAt)}</dd>{item.trashedAt && <><dt>In trash since</dt><dd>{date(item.trashedAt)}</dd></>}</dl><p>{'Original quality. No file compression.'}</p></aside>}</div>
    <footer className="lightbox-footer"><span>{item.album}</span><span>{item.kind === 'video' ? 'Video' : 'Photo'} &middot; {bytes(item.size)}</span></footer>
  </Modal>;
}
