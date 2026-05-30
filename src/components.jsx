import { useState, useLayoutEffect, useEffect, useRef } from 'react';
import { STATUS } from './data.js';

const ICONS = {
  calendar: 'M8 2v3M16 2v3M3.5 9h17M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  inbox: 'M3 12h5l2 3h4l2-3h5M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  phone: 'M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L16 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2Z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z',
  building: 'M3 21h18M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M9 7h.01M9 11h.01M9 15h.01M13 7h.01M13 11h.01M13 15h.01M17 9h2a2 2 0 0 1 2 2v10',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',
  chevL: 'M15 18l-6-6 6-6', chevR: 'M9 18l6-6-6-6',
  chevD: 'M6 9l6 6 6-6', chevU: 'M18 15l-6-6-6 6',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  plus: 'M12 5v14M5 12h14',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  filter: 'M3 5h18M6 12h12M10 19h4',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11',
  home: 'M3 11l9-8 9 8M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  search: 'M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  dot: 'M12 12h.01',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  trend: 'M23 6l-9.5 9.5-5-5L1 18',
};

export function Icon({ name, size = 18, sw = 1.9, style, color = 'currentColor' }) {
  const d = ICONS[name] || ICONS.dot;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      {d.split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}
    </svg>
  );
}

export function Avatar({ p, size = 34 }) {
  if (p.avatar) {
    return (
      <span className="avatar" title={p.name}
        style={{ width: size, height: size, fontSize: size * 0.4, background: p.av, overflow: 'hidden', padding: 0 }}>
        <img src={p.avatar} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
      </span>
    );
  }
  return (
    <span className="avatar" title={p.name}
      style={{ width: size, height: size, fontSize: size * 0.4, background: p.av }}>
      {p.initials}
    </span>
  );
}

export function Pill({ type, time, note, showLabel = true }) {
  const meta = STATUS[type];
  if (!meta) return null;
  return (
    <span className={'pill ' + meta.cls}>
      <span className="dot"></span>
      {showLabel && <span>{meta.label}</span>}
      {time && <span className="pt">{time}</span>}
      {!time && note && <span className="pt">{note}</span>}
    </span>
  );
}

export function Popover({ anchorRef, onClose, children, width = 300 }) {
  const [pos, setPos] = useState(null);
  const popRef = useRef(null);
  useLayoutEffect(() => {
    const a = anchorRef.current; if (!a) return;
    const r = a.getBoundingClientRect();
    const ph = popRef.current ? popRef.current.offsetHeight : 240;
    let left = r.left;
    if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12;
    let top = r.bottom + 6;
    if (top + ph > window.innerHeight - 12) top = Math.max(12, r.top - ph - 6);
    setPos({ left, top });
  }, [anchorRef, width]);
  return (
    <>
      <div className="pop-overlay" onClick={onClose}></div>
      <div className="pop" ref={popRef} style={{ width, left: pos ? pos.left : -9999, top: pos ? pos.top : 0 }}>
        {children}
      </div>
    </>
  );
}

export function Modal({ title, icon, iconBg, onClose, children, footer, width = 520 }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }}>
        <div className="modal-head">
          {icon && (
            <span style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center',
              background: iconBg || 'var(--red-tint)', flex: '0 0 38px' }}>
              {icon}
            </span>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: '-.02em' }}>{title}</div>
          </div>
          <button className="iconbtn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 90,
      background: 'var(--ink)', color: '#fff', padding: '11px 18px', borderRadius: 11, fontWeight: 600,
      fontSize: 13.5, boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: 9,
      animation: 'pop .2s ease' }}>
      <span style={{ color: 'var(--c-turno)' }}><Icon name="check" size={17} sw={2.6} /></span>
      {msg}
    </div>
  );
}

export function SectionHead({ title, sub, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', whiteSpace: 'nowrap' }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
      </div>
      <div className="spacer"></div>
      {right}
    </div>
  );
}
