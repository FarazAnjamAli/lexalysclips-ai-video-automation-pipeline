"use client";

import { useEffect, useRef, useState } from "react";
import { LabelInput } from "./LabelInput";
import { GripVertical, Volume2, VolumeX, Scissors, X, ChevronUp, ChevronDown, Play, ImageIcon } from "lucide-react";
import { clipLen, fmtTime } from "@/lib/api";
import type { Item, Media } from "@/lib/types";

export function ClipCard({
  it, m, rank, single, isFirst, isLast, onChange, onRemove, onMove, dragProps, dragging, over, suggestions,
}: {
  it: Item; m?: Media; rank: number; single: boolean; isFirst: boolean; isLast: boolean; suggestions: string[];
  onChange: (patch: Partial<Item>) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void;
  dragProps: React.HTMLAttributes<HTMLDivElement>; dragging: boolean; over: boolean;
}) {
  const [trim, setTrim] = useState(false);
  const vid = useRef<HTMLVideoElement>(null);
  const soundOn = it.muted === false;
  const len = clipLen(it);
  const winner = rank === 1 && !single;

  const playRange = () => {
    const v = vid.current; if (!v) return;
    v.currentTime = it.in; v.play();
    const stop = () => { if (v.currentTime >= it.out) { v.pause(); v.removeEventListener("timeupdate", stop); } };
    v.addEventListener("timeupdate", stop);
  };

  return (
    <div
      {...dragProps}
      className={`group relative flex rounded-[10px] border bg-surface transition-colors
        ${dragging ? "opacity-40" : ""} ${over ? "border-accent" : winner ? "border-[var(--accent-line)]" : "border-border hover:border-border-strong"}`}
    >
      {/* rank rail */}
      <div className="flex flex-col items-center justify-between w-11 sm:w-14 shrink-0 py-3 border-r border-border">
        {single ? (
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-faint [writing-mode:vertical-rl] rotate-180">Clip</span>
        ) : (
          <span className={`font-mono text-[18px] sm:text-[22px] font-semibold leading-none tracking-tight tabular-nums ${winner ? "text-accent" : "text-text"}`}>
            <span className="text-[13px] text-faint align-top mr-px">#</span>{rank}
          </span>
        )}
        {!single && (
          <span className="pointer-coarse:hidden cursor-grab active:cursor-grabbing text-faint hover:text-text p-1" title="Drag to re-rank" data-handle>
            <GripVertical className="size-4" strokeWidth={1.5} />
          </span>
        )}
      </div>

      {/* thumb */}
      <div className="relative w-16 sm:w-[88px] shrink-0 m-2 sm:m-2.5 mr-0 sm:mr-0 rounded-[7px] overflow-hidden bg-surface-3 aspect-[4/5] self-start">
        {m ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/thumbs/${m.thumb}`} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[10px] text-danger text-center p-1">Missing file</div>
        )}
        <span className="absolute bottom-1 right-1 chip h-4 px-1 border-transparent bg-black/75 text-white text-[10px] font-mono">{len.toFixed(1)}s</span>
      </div>

      {/* body */}
      <div className="flex-1 min-w-0 p-2 sm:p-2.5 flex flex-col gap-2">
        <LabelInput
          value={it.label}
          onChange={(label) => onChange({ label })}
          suggestions={suggestions}
          placeholder={single ? 'Caption, e.g. "Unreal finish"' : `Label for #${rank}, e.g. "No-look pass"`}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <TimeInput label="In" value={it.in} onChange={(v) => onChange({ in: v })} />
          <TimeInput label="Out" value={it.out} onChange={(v) => onChange({ out: v })} />
          <span className="hidden sm:inline text-[11px] text-faint font-mono tabular-nums mr-auto">
            {m?.isImage ? <span className="inline-flex items-center gap-1"><ImageIcon className="size-3" /> image</span> : `of ${fmtTime(m?.duration || 0)}`}
          </span>

          <button
            type="button"
            onClick={() => onChange({ muted: soundOn })}
            className={`btn btn-sm ${soundOn ? "border-[var(--accent-line)] bg-accent-soft text-accent hover:bg-accent-soft" : "btn-outline text-muted"}`}
            title={soundOn ? "Clip's own sound is ON (music ducks under it)" : "Clip is muted (music only)"}
          >
            {soundOn ? <Volume2 /> : <VolumeX />} {soundOn ? "Sound on" : "Muted"}
          </button>
          {!m?.isImage && m && (
            <button type="button" className={`btn btn-sm ${trim ? "bg-surface-3" : "btn-outline"}`} onClick={() => setTrim((v) => !v)}>
              <Scissors /> Trim
            </button>
          )}
        </div>

        {trim && m && (
          <div className="flex flex-col gap-2 pt-1">
            <video ref={vid} src={`/media/${m.file}#t=${it.in}`} controls muted playsInline className="w-full max-h-72 rounded-[7px] bg-black" />
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
              <button className="btn btn-sm" onClick={() => vid.current && onChange({ in: +vid.current.currentTime.toFixed(2) })}>Set In here</button>
              <button className="btn btn-sm" onClick={() => vid.current && onChange({ out: +vid.current.currentTime.toFixed(2) })}>Set Out here</button>
              <button className="btn btn-sm btn-primary col-span-2" onClick={playRange}><Play /> Play In to Out</button>
            </div>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="flex flex-col items-center gap-0.5 p-1 sm:p-1.5 border-l border-border">
        {!single && <>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onMove(-1)} disabled={isFirst} title="Move up (plays earlier)" aria-label="Move up"><ChevronUp /></button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onMove(1)} disabled={isLast} title="Move down (closer to #1)" aria-label="Move down"><ChevronDown /></button>
        </>}
        <button className="btn btn-danger btn-sm btn-icon mt-auto" onClick={onRemove} title="Remove from Short" aria-label="Remove from Short"><X /></button>
      </div>
    </div>
  );
}

/** "75", "75.5", "1:15", "1:15.5" -> seconds. Returns NaN if it can't be read. */
function parseTime(t: string): number {
  t = t.trim().replace(",", ".");
  if (!t) return NaN;
  if (t.includes(":")) {
    const [m, sec = ""] = t.split(":");
    const mm = m === "" ? 0 : parseInt(m, 10); const ss = sec === "" ? 0 : parseFloat(sec);
    return isNaN(mm) || isNaN(ss) ? NaN : mm * 60 + ss;
  }
  return parseFloat(t);
}
/** seconds -> "12.5" under a minute, "1:15" / "1:15.5" from a minute up */
function showTime(v: number): string {
  v = Math.max(0, +(+v || 0).toFixed(2));
  if (v < 60) return String(v);
  const m = Math.floor(v / 60); const sec = +(v - m * 60).toFixed(2);
  const [whole, frac] = String(sec).split(".");
  return `${m}:${whole.padStart(2, "0")}${frac ? "." + frac : ""}`;
}

function TimeInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  // Keep what the user is typing as text; only push valid times up. Accepts seconds (75) or minutes:seconds (1:15).
  const [text, setText] = useState(showTime(value ?? 0));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(showTime(value ?? 0)); }, [value]);
  return (
    <label title="Seconds (75) or minutes:seconds (1:15)" className="flex items-center h-7 pointer-coarse:h-9 rounded-[7px] border border-border bg-surface hover:border-border-strong focus-within:border-[var(--accent-line)] overflow-hidden">
      <span className="px-2 h-full grid place-items-center text-[10.5px] font-medium uppercase tracking-wider text-faint border-r border-border bg-surface-2">{label}</span>
      <input
        type="text" inputMode="decimal" value={text} placeholder="0:00"
        onFocus={(e) => { focused.current = true; e.target.select(); }}
        onBlur={() => { focused.current = false; const n = parseTime(text); const v = isNaN(n) ? 0 : Math.max(0, +n.toFixed(2)); setText(showTime(v)); onChange(v); }}
        onChange={(e) => {
          const t = e.target.value.replace(",", ".");
          if (!/^\d*(:\d{0,2})?\.?\d*$/.test(t)) return;
          setText(t);
          const n = parseTime(t); if (!isNaN(n)) onChange(+n.toFixed(2));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const v = Math.max(0, +((parseTime(text) || 0) + (e.key === "ArrowUp" ? 0.1 : -0.1)).toFixed(2));
            setText(showTime(v)); onChange(v);
          }
        }}
        className="w-16 sm:w-[72px] h-full px-2 bg-transparent outline-none font-mono text-[12px] pointer-coarse:text-[16px] tabular-nums"
      />
    </label>
  );
}
