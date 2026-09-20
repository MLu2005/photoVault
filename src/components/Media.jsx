import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { bytes, extension } from '../lib/format.js';
export function Preview({ item, className = '' }) {
  const source = item.thumbnailUrl || (item.kind === 'image' && !['HEIC','HEIF','TIF','TIFF'].includes(extension(item.name)) ? item.url : null);
  const [failed, setFailed] = useState(false), [fallback, setFallback] = useState(false);
  useEffect(() => { setFailed(false); setFallback(false); }, [source]);
  const src = fallback ? (item.kind === 'image' ? item.url : null) : source;
  return <div className={`preview ${item.kind === 'video' ? 'video-preview' : ''} ${className}`}>
    {src && !failed ? <img src={src} loading="lazy" decoding="async" alt="" referrerPolicy="no-referrer" onError={() => { if (!fallback && item.thumbnailUrl && item.kind === 'image') setFallback(true); else setFailed(true); }}/>
      : <div className="preview-placeholder"><Icon name={item.kind === 'video' ? 'film' : 'photo'} size={34}/><span>{extension(item.name)}</span></div>}
    {item.kind === 'video' && <span className="video-play"><Icon name="play" size={18} filled/></span>}
  </div>;
}
export function MediaCard({ item, selected, selectMode, onSelect, onOpen, onFavorite, busy }) {
  return <article className={`media-card ${selected ? 'selected' : ''}`}>
    <button className="media-open" onClick={selectMode ? onSelect : onOpen} aria-label={`${selectMode ? 'Select' : 'Open'} ${item.name}`}><Preview item={item}/></button>
    <label className={`media-select ${selectMode ? 'visible' : ''}`}><input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${item.name}`} disabled={busy}/><span><Icon name="check" size={14}/></span></label>
    {!item.trashedAt && <button className={`favorite-button ${item.favorite ? 'is-favorite' : ''}`} disabled={busy} onClick={onFavorite} aria-label={`${item.favorite ? 'Remove from favorites' : 'Add to favorites'}: ${item.name}`} aria-pressed={item.favorite}><Icon name="heart" size={16} filled={item.favorite}/></button>}
    <div className="media-caption"><span title={item.name}>{item.name}</span><span>{item.kind === 'video' ? <Icon name="film" size={12}/> : null}{bytes(item.size)}</span></div>
  </article>;
}
export function MediaRow({ item, selected, onSelect, onOpen, onFavorite, busy }) {
  return <div className={`media-row ${selected ? 'selected' : ''}`}>
    <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${item.name}`} disabled={busy}/>
    <button className="row-open" onClick={onOpen}><Preview item={item}/><span><strong>{item.name}</strong><small>{item.album}</small></span></button>
    <span className="row-type">{extension(item.name)}</span><span className="row-size">{bytes(item.size)}</span>
    {!item.trashedAt && <button className={`icon-button ${item.favorite ? 'is-favorite' : ''}`} onClick={onFavorite} disabled={busy} aria-label={`Favorites: ${item.name}`} aria-pressed={item.favorite}><Icon name="heart" size={18} filled={item.favorite}/></button>}
  </div>;
}
