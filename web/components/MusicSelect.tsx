"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, Upload, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useStudio } from "./StudioProvider";

/** Grouped music picker with a listen button. Tracks that need a credit line are marked. */
export function MusicSelect({ value, onChange, withDefault = false }: { value: string; onChange: (v: string) => void; withDefault?: boolean }) {
  const { music, reloadMusic, toast } = useStudio();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (files: FileList) => {
    if (!files.length) return;
    const fd = new FormData(); [...files].forEach((f) => fd.append("files", f));
    setUploading(true);
    const r = await api<{ added?: string[] }>("/api/music/upload", { method: "POST", body: fd });
    setUploading(false); await reloadMusic();
    if (r.added?.length) { onChange(r.added[0]); toast(`Added ${r.added.length} track${r.added.length > 1 ? "s" : ""} to My uploads`, "ok"); }
    else toast("No audio files found (use .mp3, .wav or .m4a)", "error");
    if (fileRef.current) fileRef.current.value = "";
  };
  const dur = (s?: number) => (s ? `  ${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const groups: Record<string, typeof music> = {};
  music.forEach((m) => (groups[m.group] ||= []).push(m));
  const track = music.find((m) => m.file === value);

  useEffect(() => () => audio.current?.pause(), []);
  useEffect(() => { audio.current?.pause(); setPlaying(false); }, [value]);

  const toggle = () => {
    if (playing) { audio.current?.pause(); setPlaying(false); return; }
    if (!track) return;
    audio.current?.pause();
    audio.current = new Audio(`/assets/music/${track.file}`);
    audio.current.volume = 0.6;
    audio.current.onended = () => setPlaying(false);
    audio.current.play(); setPlaying(true);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1.5">
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          {withDefault ? <option value="">Template default</option> : <option value="">None</option>}
          {withDefault && <option value="none">No music</option>}
          {Object.entries(groups).map(([g, list]) => (
            <optgroup key={g} label={`${g.replace(" (credit)", "").replace(/^\w/, (c) => c.toUpperCase())} (${list.length})`}>
              {list.map((m) => <option key={m.file} value={m.file}>{m.label}{m.artist ? ` — ${m.artist}` : ""}{dur(m.duration)}{m.needsCredit ? "  · credit needed" : ""}</option>)}
            </optgroup>
          ))}
        </select>
        <button type="button" className="btn btn-icon shrink-0" onClick={toggle} disabled={!track} title={playing ? "Stop" : "Listen"} aria-label={playing ? "Stop preview" : "Listen to this track"}>
          {playing ? <Square className="!size-3 fill-current" /> : <Play />}
        </button>
        <button type="button" className="btn btn-icon shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading} title="Add your own music (.mp3 / .wav / .m4a)" aria-label="Upload your own music">
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
        </button>
        <input ref={fileRef} type="file" accept=".mp3,.wav,.m4a,audio/*" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
      </div>
      <p className="text-[11px] text-faint">{music.length} tracks · play button to listen, upload button to add your own</p>
      {track?.needsCredit && (
        <p className="text-[11px] text-warn leading-snug">Add to your description: Music by Kevin MacLeod (incompetech.com), CC BY 4.0</p>
      )}
    </div>
  );
}
