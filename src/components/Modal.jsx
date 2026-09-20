import React, { useEffect, useId, useRef } from 'react';
import { IconButton } from './Icon.jsx';
export default function Modal({ title, children, onClose, className = '', busy = false }) {
  const ref = useRef(null), titleId = useId(), closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby={titleId}
    onCancel={e => { e.preventDefault(); if (!busy) closeRef.current(); }}
    onClick={e => { if (e.target === ref.current && !busy) { const rect = ref.current.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) closeRef.current(); } }}>
    <header className="modal-header"><h2 id={titleId}>{title}</h2><IconButton icon="x" label="Close" disabled={busy} onClick={onClose}/></header>
    {children}
  </dialog>;
}
