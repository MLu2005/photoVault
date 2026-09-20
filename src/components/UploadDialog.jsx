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
    if (!actualAlbum || actualAlbum.length > 120 || /[\/\\\u0000-\u001f\u007f]/.test(actualAlbum) || actualAlbum.startsWith('.')) { setError('Podaj nazwę albumu bez /, \\ i kropki na początku (do 120 znaków).'); return; }
    if (!files.length) { setError('Najpierw wybierz pliki.'); return; }
    const result = onUpload(files, actualAlbum); if (result?.error) setError(result.error);
  }
  return <Modal title="Dodaj wspomnienia" onClose={onClose} className="upload-dialog"><form onSubmit={submit}>
    <p className="muted">{'Zdjęcia i filmy trafią do Waszej wspólnej biblioteki w oryginalnej jakości.'}</p>
    <div className={`dropzone ${drag ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); e.stopPropagation(); setDrag(false); add(e.dataTransfer.files); }}>
      <span className="drop-icon"><Icon name="upload" size={27}/></span><h3>{'Przeciągnij tutaj pliki'}</h3><p>{'lub wybierz je z telefonu i komputera'}</p><button className="button" type="button" onClick={() => input.current.click()}>Wybierz pliki</button>
      <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" aria-label="Wybierz zdjęcia i filmy" onChange={e => { add(e.target.files); e.target.value = ''; }}/>
      <small>{`Zdjęcia i filmy · do ${bytes(maxBytes)} na plik`}</small>
    </div>
    {files.length > 0 && <div className="selected-files"><span><strong>{files.length}</strong> {'wybranych plików'} &middot; {bytes(files.reduce((n,f) => n + f.size, 0))}</span><button type="button" className="text-button" onClick={() => setFiles([])}>{'Wyczyść'}</button><p>{files.slice(0,3).map(f => f.name).join(', ')}{files.length > 3 ? ` +${files.length - 3}` : ''}</p></div>}
    <label htmlFor="upload-album">Zapisz w albumie</label><select id="upload-album" value={album} onChange={e => setAlbum(e.target.value)}>{albums.map(name => <option key={name} value={name}>{name}</option>)}<option value="">+ Nowy album</option></select>
    {album === '' && <><label htmlFor="new-upload-album">Nazwa nowego albumu</label><input id="new-upload-album" value={newName} onChange={e => setNewName(e.target.value)} maxLength={120} placeholder="np. Nasz weekend nad morzem" required/></>}
    <p className="hint"><Icon name="info" size={15}/>{'MOV, HEIC i niektóre kodeki mogą wymagać pobrania pliku. Nie konwertujemy oryginałów.'}</p>
    {error && <div className="alert error" role="alert">{error}</div>}
    <div className="modal-footer"><button type="button" className="button ghost" onClick={onClose}>Anuluj</button><button className="button primary" disabled={!files.length}><Icon name="upload"/>{'Rozpocznij przesyłanie'}</button></div>
  </form></Modal>;
}
