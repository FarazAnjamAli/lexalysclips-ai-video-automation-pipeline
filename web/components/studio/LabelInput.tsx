"use client";

import { useMemo, useRef, useState } from "react";
import { CornerDownLeft } from "lucide-react";
import { matchLabels } from "@/lib/labels";

/**
 * Label field with suggestions. The top match shows as grey ghost text;
 * Tab or Enter accepts it, arrow keys pick another, Esc closes the list.
 */
export function LabelInput({ value, onChange, suggestions, placeholder }: {
  value: string; onChange: (v: string) => void; suggestions: string[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const list = useMemo(() => matchLabels(value, suggestions), [value, suggestions]);
  const pick = list[Math.min(hi, list.length - 1)];
  // ghost completion only when the highlighted suggestion continues what's typed
  const ghost = open && pick && value && pick.toLowerCase().startsWith(value.toLowerCase()) ? pick.slice(value.length) : "";

  const accept = (s: string) => { onChange(s); setOpen(false); setHi(0); };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={ref}
          className="input h-8 font-medium relative z-[1] bg-transparent focus:bg-transparent"
          value={value}
          placeholder={open && !value && pick ? "" : placeholder}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => { setOpen(true); setHi(0); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (!open || !list.length) return;
            if (e.key === "Tab" || e.key === "Enter") { if (pick) { e.preventDefault(); accept(pick); } }
            else if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => (h + 1) % list.length); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => (h - 1 + list.length) % list.length); }
            else if (e.key === "Escape") setOpen(false);
          }}
        />
        {/* ghost text sits behind the transparent input */}
        <div aria-hidden className="absolute inset-0 rounded-[var(--radius)] bg-surface border border-transparent px-2.5 flex items-center text-[13px] pointer-coarse:text-[16px] font-medium pointer-events-none whitespace-pre overflow-hidden">
          <span className="invisible">{value}</span>
          <span className="text-faint">{ghost || (open && !value && pick ? pick : "")}</span>
        </div>
      </div>

      {open && list.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 panel bg-surface-2 p-1 shadow-xl shadow-black/50">
          {list.map((s, i) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); accept(s); }}
              onClick={() => accept(s)}
              onMouseEnter={() => setHi(i)}
              className={`w-full flex items-center justify-between gap-2 h-7 pointer-coarse:h-10 px-2 rounded-[6px] text-left text-[12.5px] cursor-pointer
                ${i === hi ? "bg-surface-3 text-text" : "text-muted"}`}
            >
              <span className="truncate">{s}</span>
              {i === hi && <span className="pointer-coarse:hidden inline-flex items-center gap-1 text-[10.5px] text-faint shrink-0"><kbd className="font-mono">Tab</kbd> <CornerDownLeft className="size-3" /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
