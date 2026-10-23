"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, Search, Plus, Trash2, Link2, Loader2, Volume2, ImageIcon, Check, ArrowDownToLine } from "lucide-react";
import { api, fmtTime, watchJob } from "@/lib/api";
import { labelFromMediaName } from "@/lib/labels";
import type { Item, Job, Media } from "@/lib/types";
import { useStudio } from "../StudioProvider";
import { PLATFORMS, PlatformIcon, detectPlatform } from "../PlatformIcon";
import { Progress, Switch } from "../ui";

export function MediaPanel({ onAdded }: { onAdded?: (name: string) => void }) {
  const { media, project, patchProject, reloadMedia, toast } = useStudio();
  const [q, setQ] = useState("");
  const [url, setUrl] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [keepAudio, setKeepAudio] = useState(false);
  const [busy, setBusy] = useState<{ label: string; job: Job } | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const platform = detectPlatform(url);

  const used = useMemo(() => new Set(project?.items.map((i) => i.media) || []), [project]);
  const list = media.filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase()));

  const runJob = async (label: string, jobId: string) => {
    setBusy({ label, job: { status: "running", progress: 0 } });
    const j = await watchJob(jobId, (j) => setBusy({ label, job: j }));
    setBusy(null);
    await reloadMedia();
    if (j.status === "done") toast(`${label} finished`, "ok");
    else toast(j.msg || `${label} failed`, "error");
    return j;
  };

  const upload = async (files: FileList | File[]) => {
    const arr = [...files];
    if (!arr.length) return;
    const fd = new FormData();
    arr.forEach((f) => fd.append("files", f));
    setBusy({ label: "Uploading", job: { status: "running", progress: 0, msg: `${arr.length} file(s)` } });
    const r = await api<{ job: string }>("/api/upload", { method: "POST", body: fd });
    await runJob("Upload", r.job);
    if (fileRef.current) fileRef.current.value = "";
  };

  const importLink = async () => {
    if (!url.trim()) return;
    const r = await api<{ job?: string; error?: string }>("/api/link", {
      method: "POST", body: { url: url.trim(), start: start || null, end: end || null, keepAudio },
    });
    if (!r.job) return toast(r.error || "Could not start download", "error");
    const j = await runJob("Download", r.job);
    if (j.status === "done") { setUrl(""); setStart(""); setEnd(""); }
  };

  const addItem = (m: Media) => {
    if (!project) return;
    const out = m.isImage ? 3 : Math.min(m.duration, 6);
    const it: Item = { media: m.id, in: 0, out: +out.toFixed(2), label: labelFromMediaName(m.name), muted: !m.keepAudio };
    patchProject((p) => ({ items: [it, ...p.items] }));
    onAdded?.(it.label || m.name);
  };

  const del = async (m: Media) => {
    if (!confirm(`Delete "${m.name}" from your library?`)) return;
    await api(`/api/media/${m.id}`, { method: "DELETE" });
    reloadMedia();
  };

  return (
    <aside className="flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-visible lg:border-r border-border bg-surface/40">
      <div className="p-4 flex flex-col gap-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Library</h2>
          <span className="text-[11px] text-faint tabular-nums">{media.length} items</span>
        </div>

        {/* upload dropzone */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
          className={`group flex items-center gap-3 rounded-[var(--radius)] border border-dashed px-3 py-3 text-left transition-colors cursor-pointer
            ${drag ? "border-accent bg-accent-soft" : "border-border-strong hover:border-[var(--accent-line)] hover:bg-surface-2"}`}
        >
          <span className="grid place-items-center size-8 rounded-[7px] bg-surface-3 text-muted group-hover:text-accent"><Upload className="size-4" strokeWidth={1.75} /></span>
          <span className="flex flex-col">
            <span className="text-[12.5px] font-medium">Upload clips or images</span>
            <span className="text-[11px] text-faint">Click or drop files here</span>
          </span>
          <input ref={fileRef} type="file" multiple accept="video/*,image/*" hidden onChange={(e) => e.target.files && upload(e.target.files)} />
        </button>

        {/* link import */}
        <div className="rounded-[var(--radius)] border border-border bg-surface p-2.5 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 px-0.5">
            {PLATFORMS.slice(0, 4).map((p) => (
              <span key={p.id} title={p.name} className={`transition-opacity ${platform && platform !== p.id ? "opacity-25" : ""}`}>
                <PlatformIcon platform={p.id} tile size={20} />
              </span>
            ))}
            <span className="ml-auto text-[10.5px] text-faint">HD · no watermark</span>
          </div>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint">
              {platform ? <PlatformIcon platform={platform} size={14} /> : <Link2 className="size-3.5" strokeWidth={1.75} />}
            </span>
            <input className="input pl-8" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && importLink()}
              placeholder="Paste a TikTok, YouTube or Instagram link" />
          </div>
          <div className="flex gap-1.5">
            <input className="input font-mono text-[12px]" value={start} onChange={(e) => setStart(e.target.value)} placeholder="From (sec)" inputMode="decimal" aria-label="Optional: start downloading from this second" />
            <input className="input font-mono text-[12px]" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="To (sec)" inputMode="decimal" aria-label="Optional: stop downloading at this second" />
            <button className="btn btn-primary shrink-0" onClick={importLink} disabled={!url.trim() || !!busy}>
              <ArrowDownToLine /> Import
            </button>
          </div>
          <p className="text-[11px] text-faint -mt-0.5 px-0.5">From / To are optional — leave empty to grab the whole video.</p>
          <Switch checked={keepAudio} onChange={setKeepAudio} label="Keep original sound" />
          {platform === "instagram" && <p className="text-[11px] text-faint leading-snug">Instagram needs you logged in on your browser (set in Settings).</p>}
        </div>

        {busy && (
          <div className="flex flex-col gap-1.5 rounded-[var(--radius)] border border-[var(--accent-line)] bg-accent-soft px-3 py-2">
            <div className="flex items-center gap-2 text-[12px]">
              <Loader2 className="size-3.5 animate-spin text-accent" />
              <span className="font-medium">{busy.label}</span>
              <span className="text-muted truncate">{busy.job.msg}</span>
            </div>
            <Progress value={busy.job.progress || 0} />
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-faint" strokeWidth={1.75} />
          <input className="input pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search library" />
        </div>
      </div>

      {/* grid */}
      <div className="p-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
        {!list.length ? (
          <p className="text-center text-[12px] text-faint py-10">{media.length ? "No matches" : "Your clips will appear here"}</p>
        ) : (
          <>
          <p className="text-[11.5px] text-faint mb-2.5">Tap a clip to add it to your Short.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5">
            {list.map((m) => {
              const src = detectPlatform(m.source);
              const inUse = used.has(m.id);
              return (
                <div key={m.id} className="group relative rounded-[8px] overflow-hidden border border-border bg-surface-2 hover:border-border-strong transition-colors">
                  <button type="button" onClick={() => addItem(m)} className="block w-full text-left cursor-pointer" title={`Add "${m.name}" to the Short`}>
                    <div className="relative aspect-[4/5] bg-surface-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/thumbs/${m.thumb}`} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
                      <div className="absolute top-1.5 left-1.5 flex gap-1">
                        {src && <PlatformIcon platform={src} tile size={18} />}
                        {m.keepAudio && <span className="grid place-items-center size-[18px] rounded-[6px] bg-black/70 text-white" title="Keeps original sound"><Volume2 className="size-3" strokeWidth={2} /></span>}
                      </div>
                      <span className="absolute bottom-1.5 right-1.5 chip h-[18px] border-transparent bg-black/70 text-white font-mono">
                        {m.isImage ? <><ImageIcon className="size-3" /> IMG</> : fmtTime(m.duration)}
                      </span>
                      {inUse && <span className="absolute bottom-1.5 left-1.5 chip chip-accent h-[18px] bg-black/70"><Check className="size-3" /> In use</span>}
                      <span className="absolute inset-0 hidden pointer-fine:grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="grid place-items-center size-9 rounded-full bg-accent text-accent-ink shadow-lg"><Plus className="size-4.5" strokeWidth={2.25} /></span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 pl-2 pr-1.5 py-1.5">
                      <span className="flex-1 min-w-0 text-[11.5px] text-muted truncate">{m.name}</span>
                      <span className="pointer-fine:hidden grid place-items-center size-6 shrink-0 rounded-full bg-accent text-accent-ink" aria-hidden><Plus className="size-3.5" strokeWidth={2.5} /></span>
                    </div>
                  </button>
                  <button type="button" onClick={() => del(m)} title="Delete from library" aria-label={`Delete ${m.name} from library`}
                    className="absolute top-1.5 right-1.5 grid place-items-center size-8 pointer-fine:size-6 rounded-[6px] bg-black/70 text-white/80 hover:text-danger pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer">
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>
    </aside>
  );
}
