import React from 'react';
const paths = {
  vault:'M4 5h16v15H4z M8 5V3h8v2 M9 10h6v5H9z M2 9h2 M2 16h2 M12 10v5',
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  folder:'M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z',
  heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z',
  film:'M4 3h16v18H4z M8 3v18 M16 3v18 M4 8h4 M4 16h4 M16 8h4 M16 16h4',
  trash:'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  upload:'M12 16V3 M7 8l5-5 5 5 M4 14v6h16v-6',
  download:'M12 3v13 M7 11l5 5 5-5 M4 16v5h16v-5',
  plus:'M12 4v16 M4 12h16', x:'M5 5l14 14 M19 5L5 19', check:'M4 12l5 5L20 6',
  left:'M15 5l-7 7 7 7', right:'M9 5l7 7-7 7', down:'M5 9l7 7 7-7',
  search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
  moon:'M21 13a9 9 0 0 1-10-10A9 9 0 1 0 21 13z',
  sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5',
  menu:'M4 6h16 M4 12h16 M4 18h16', list:'M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01',
  refresh:'M20 7V3l-4 4 M20 7a9 9 0 1 0 1 8',
  logout:'M9 3H4v18h5 M10 12h11 M17 8l4 4-4 4',
  lock:'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3',
  photo:'M3 3h18v18H3z M3 16l6-6 5 5 3-3 4 4 M15 7h.01',
  play:'M8 4l12 8-12 8z', info:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 11v6 M12 7h.01',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  restore:'M3 10l4-4 4 4 M7 6v8a6 6 0 1 0 6-6',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  zoom:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6 M7 10h6 M10 7v6',
  cloud:'M6 19a4 4 0 1 1-1-7 7 7 0 0 1 14-1 4 4 0 0 1 0 8H6z',
  arrow:'M4 12h16 M14 6l6 6-6 6', clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',
};
export default function Icon({ name, size = 20, className = '', filled = false }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d={paths[name] || paths.photo}/></svg>;
}
export function IconButton({ icon, label, className = '', ...props }) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} {...props}><Icon name={icon}/></button>;
}
