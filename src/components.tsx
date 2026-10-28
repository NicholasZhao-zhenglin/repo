import { useEffect, useRef, type ReactNode } from 'react';
import { Feather, X } from 'lucide-react';
import { portraitURL, type Character } from '../shared/model';

export function Emblem({ small = false }: { small?: boolean }) {
  return <span className={`emblem ${small ? 'small' : ''}`} aria-hidden="true"><Feather size={small ? 19 : 25} strokeWidth={1.4}/></span>;
}
export function Portrait({ character, className = '' }: { character: Character; className?: string }) {
  const src = portraitURL(character);
  return <div className={`portrait ${character.faction} ${className}`}>
    {src ? <img src={src} alt={`${character.name}的头像`} style={{ objectPosition: `50% ${character.portraitPosition}%` }} loading="lazy"/> : <div className="portrait-placeholder"><span className="portrait-orbit"/><span className="portrait-initial">{character.name.slice(0, 1)}</span><span className="portrait-caption">UNWRITTEN STORIES</span></div>}
  </div>;
}
export function Modal({ title, children, onClose, className = '', labelledBy = 'modal-title' }: { title: string; children: ReactNode; onClose: () => void; className?: string; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    const timer = window.setTimeout(() => (dialog.querySelector('[data-autofocus]') as HTMLElement | null ?? dialog).focus(), 30);
    const onKey = (event: KeyboardEvent) => {
      const dialogs = [...document.querySelectorAll('[role="dialog"]')];
      if (dialogs.at(-1) !== dialog) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key === 'Tab') {
        const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')].filter(e => e.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (!first) { event.preventDefault(); dialog.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', onKey, true); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} className={`modal ${className}`}>
      <header className="modal-header"><div><span className="eyebrow">PERSONA ARCHIVE</span><h2 id={labelledBy}>{title}</h2></div><button type="button" className="icon-button" aria-label="关闭窗口" onClick={onClose}><X size={20}/></button></header>
      {children}
    </div>
  </div>;
}
export function Confirm({ title, body, action, onConfirm, onCancel, busy = false }: { title: string; body: string; action: string; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  return <Modal title={title} onClose={() => !busy && onCancel()} className="confirm-modal" labelledBy="confirm-title">
    <p className="confirm-body">{body}</p><div className="modal-footer"><button className="button secondary" onClick={onCancel} disabled={busy} data-autofocus>取消</button><button className="button danger" onClick={onConfirm} disabled={busy}>{busy ? '正在处理…' : action}</button></div>
  </Modal>;
}
export function ArchiveIllustration() {
  return <svg className="archive-illustration" viewBox="0 0 330 250" fill="none" aria-hidden="true">
    <circle cx="165" cy="126" r="104" stroke="#DED8CE" strokeDasharray="3 7"/>
    <path d="M39 205H290M60 210H273" stroke="#D6CFC4"/>
    <g transform="rotate(-10 136 138)"><rect x="72" y="47" width="134" height="160" rx="5" fill="#ECE8DF" stroke="#CFC6B8"/><path d="M89 67h69M89 76h42" stroke="#C4B9A9" strokeWidth="2"/></g>
    <g transform="rotate(7 188 133)"><rect x="116" y="35" width="137" height="174" rx="5" fill="#FFFEFA" stroke="#CFC6B8"/>
      <rect x="131" y="50" width="107" height="106" rx="2" fill="#EDE4DE"/>
      <circle cx="184" cy="92" r="24" fill="#A88C83"/><path d="M145 148c0-24 16-39 39-39s39 15 39 39" fill="#A88C83"/>
      <path d="M133 173h56M133 183h88M133 191h65" stroke="#BFB4A7" strokeWidth="2"/>
      <path d="M215 30v23c0 9 12 9 12 0V29c0-5-7-5-7 0v23" stroke="#927659" strokeWidth="3"/>
    </g>
    <circle cx="247" cy="192" r="28" fill="#F5EEE8" stroke="#905348"/><circle cx="247" cy="192" r="22" stroke="#905348" strokeDasharray="2 3"/>
    <path d="M237 192h20M247 182v20" stroke="#905348" strokeWidth="1.5"/>
    <path d="M50 88h14M57 81v14M272 76h10M277 71v10" stroke="#B9AFA2"/>
  </svg>;
}
