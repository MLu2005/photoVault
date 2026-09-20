import React, { useRef, useState } from 'react';
import Modal from './Modal.jsx';
import Icon from './Icon.jsx';
import { ACCEPT, bytes } from '../lib/format.js';
export default function UploadDialog({ albums, initialAlbum, initialFiles = [], maxBytes, onClose, onUpload }) {
  const [files, setFiles] = useState(initialFiles), [album, setAlbum] = useState(initialAlbum || albums[0] || '');
  const [newName, setNewName] = useState(''), [error, setError] = useState(''), [drag, setDrag] = useState(false);
  const input = useRef(null);
  const actualAlbum = album === '' ? newName.trim().normalize('NFC') : album;
  function add(list) {
    // FileList is live: snapshot it before the input value is reset.
    const incoming = Array.from(list || []);
    setFiles(previous => {
      const all = new Map(previous.map(file => [`${file.name}|${file.size}|${file.lastModified}`, file]));
      incoming.forEach(file => all.set(`${file.name}|${file.size}|${file.lastModified}`, file)); return [...all.values()];
    });
  }
  function submit(e) {
    e.preventDefault(); setError('');
    if (!actualAlbum || actualAlbum.length > 120 || /[\/\\\u0000-\u001f\u007f]/.test(actualAlbum) || actualAlbum.startsWith('.')) { setError('Enter an album name without /, \\ or a leading dot (up to 120 characters).'); return; }
    if (!files.length) { setError('Select files first.'); return; }
    const result = onUpload(files, actualAlbum); if (result?.error) setError(result.error);
  }
  return <Modal title="Add memories" onClose={onClose} className="upload-dialog"><form onSubmit={submit}>
    <p className="muted">{'Photos and videos will be added to your shared library in their original quality.'}</p>
    <div className={`dropzone ${drag ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); e.stopPropagation(); setDrag(false); add(e.dataTransfer.files); }}>
      <span className="drop-icon"><Icon name="upload" size={27}/></span><h3>{'Drag files here'}</h3><p>{'or choose them from your phone or computer'}</p><button className="button" type="button" onClick={() => input.current.click()}>Choose files</button>
      <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" aria-label="Choose photos and videos" onChange={e => { add(e.target.files); e.target.value = ''; }}/>
      <small>{`Photos and videos · up to ${bytes(maxBytes)} per file`}</small>
    </div>
    {files.length > 0 && <div className="selected-files"><span><strong>{files.length}</strong> {'selected files'} &middot; {bytes(files.reduce((n,f) => n + f.size, 0))}</span><button type="button" className="text-button" onClick={() => setFiles([])}>{'Clear'}</button><p>{files.slice(0,3).map(f => f.name).join(', ')}{files.length > 3 ? ` +${files.length - 3}` : ''}</p></div>}
    <label htmlFor="upload-album">Save to album</label><select id="upload-album" value={album} onChange={e => setAlbum(e.target.value)}>{albums.map(name => <option key={name} value={name}>{name}</option>)}<option value="">+ New album</option></select>
    {album === '' && <><label htmlFor="new-upload-album">New album name</label><input id="new-upload-album" value={newName} onChange={e => setNewName(e.target.value)} maxLength={120} placeholder="e.g. Our weekend by the sea" required/></>}
    <p className="hint"><Icon name="info" size={15}/>{'MOV, HEIC, and some codecs may require downloading the file. We do not convert originals.'}</p>
    {error && <div className="alert error" role="alert">{error}</div>}
    <div className="modal-footer"><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={!files.length}><Icon name="upload"/>{'Start upload'}</button></div>
  </form></Modal>;
}
