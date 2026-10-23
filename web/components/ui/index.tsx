"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Labelled form row */
export function Field({ label, hint, children, className = "" }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="label">{label}</span>
        {hint ? <span className="text-[11px] text-faint mb-1.5 tabular-nums">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** Pill-style segmented control */
export function Segmented<T extends string>({ value, onChange, options, size = "md" }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; size?: "sm" | "md";
}) {
  return (
    <div className="flex p-0.5 rounded-[var(--radius)] border border-border bg-surface gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-[6px] ${size === "sm" ? "h-6 text-[11.5px]" : "h-7 text-[12px]"} font-medium transition-colors cursor-pointer
            ${value === o.value ? "bg-surface-3 text-text shadow-[inset_0_0_0_1px_var(--border-strong)]" : "text-muted hover:text-text"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** On/off switch */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[12.5px] text-muted hover:text-text">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[18px] w-8 rounded-full border transition-colors cursor-pointer
          ${checked ? "bg-accent border-accent" : "bg-surface-3 border-border-strong"}`}
      >
        <span className={`absolute top-[2px] size-3 rounded-full transition-all ${checked ? "left-[16px] bg-accent-ink" : "left-[2px] bg-muted"}`} />
      </button>
      {label}
    </label>
  );
}

/** Thin progress bar */
export function Progress({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-1 w-full rounded-full bg-surface-3 overflow-hidden ${className}`}>
      <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

/** Modal dialog */
export function Dialog({ open, onClose, title, children, width = 520 }: {
  open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true"
        className="panel w-full max-h-[92dvh] sm:max-h-[86vh] flex flex-col shadow-2xl shadow-black/60 bg-surface rounded-b-none sm:rounded-[10px] pb-[env(safe-area-inset-bottom)]"
        style={{ maxWidth: width }}>
        <div className="flex items-center justify-between pl-5 pr-3 h-14 sm:h-12 border-b border-border shrink-0">
          <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/** Empty-state block */
export function Empty({ icon, title, children }: { icon?: React.ReactNode; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-12 px-6 border border-dashed border-border-strong rounded-[10px]">
      {icon ? <div className="text-faint [&_svg]:size-6 [&_svg]:stroke-[1.5]">{icon}</div> : null}
      <div className="text-[13px] font-medium">{title}</div>
      {children ? <div className="text-[12px] text-muted max-w-xs">{children}</div> : null}
    </div>
  );
}

/** Small click-to-open menu (works on touch — no hover needed) */
export function Menu({ trigger, children, align = "right" }: { trigger: React.ReactNode; children: React.ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close); window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div onClick={() => setOpen(false)}
          className={`absolute top-[calc(100%+4px)] ${align === "right" ? "right-0" : "left-0"} z-50 min-w-[190px] panel bg-surface-2 p-1 shadow-xl shadow-black/50 flex flex-col`}>
          {children}
        </div>
      )}
    </div>
  );
}

/** A row inside <Menu> */
export function MenuItem({ icon, children, onClick, danger }: { icon?: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-2.5 h-10 sm:h-8 px-2.5 rounded-[6px] text-left text-[13px] sm:text-[12.5px] cursor-pointer [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]
        ${danger ? "text-danger hover:bg-danger-soft" : "text-text hover:bg-surface-3"}`}>
      {icon}{children}
    </button>
  );
}
