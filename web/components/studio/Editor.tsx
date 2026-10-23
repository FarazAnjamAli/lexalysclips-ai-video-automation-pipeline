"use client";

import { useMemo, useState } from "react";
import { POPULAR_LABELS, labelFromMediaName } from "@/lib/labels";
import { Plus, Copy, Trash2, Sparkles, Captions, Loader2, ListOrdered, Clock3, MoreHorizontal, FolderOpen, ArrowRight } from "lucide-react";
import { api, totalLen, watchJob } from "@/lib/api";
import type { Item, Meta } from "@/lib/types";
import { BRAND } from "@/config/brand";
import { useStudio } from "../StudioProvider";
import { ClipCard } from "./ClipCard";
import { MetaDialog } from "./MetaDialog";
import { Empty, Field, Menu, MenuItem } from "../ui";

export function Editor({ onAddClips, onRender }: { onAddClips?: () => void; onRender?: () => void } = {}) {
  const { project: P, projects, media, setCurrentId, patchProject, newProject, deleteProject, flushSave, reloadProjects, toast } = useStudio();
  const [armed, setArmed] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  // labels used before (newest Shorts first) feed the suggestion list
  const pastLabels = useMemo(() => {
    const seen = new Set<string>(); const out: string[] = [];
    projects.forEach((p) => p.items.forEach((it) => { const l = (it.label || "").trim(); if (l && !seen.has(l.toLowerCase())) { seen.add(l.toLowerCase()); out.push(l); } }));
    return out;
  }, [projects]);

  if (!P) return <section className="flex-1 p-6 text-muted">Loading…</section>;

  const n = P.items.length;
  const single = n === 1;
  const total = totalLen(P.items);
  const tooLong = total > BRAND.maxShortSeconds;

  const setItem = (i: number, patch: Partial<Item>) =>
    patchProject((p) => ({ items: p.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) }));
  const move = (from: number, to: number) =>
    patchProject((p) => {
      if (to < 0 || to >= p.items.length || from === to) return {};
      const items = [...p.items]; const [x] = items.splice(from, 1); items.splice(to, 0, x);
      return { items };
    });

  const genMeta = async () => {
    setAiBusy("meta"); await flushSave();
    const r = await api<Meta>(`/api/generate-meta/${P.id}`, { method: "POST", body: {} });
    setAiBusy(null);
    if (r.error) return toast(r.error, "error");
    setMeta(r);
  };

  const genCaps = async () => {
    if (!P.items.some((it) => it.muted === false))
      return toast("Auto-captions read a clip's own speech. Turn a clip's sound on first, then try again.", "info");
    setAiBusy("caps"); await flushSave();
    const r = await api<{ job?: string; error?: string }>(`/api/captions/${P.id}`, { method: "POST", body: {} });
    if (!r.job) { setAiBusy(null); return toast(r.error || "Could not start captions", "error"); }
    const j = await watchJob(r.job);
    await reloadProjects();
    setAiBusy(null);
    toast(j.msg || (j.status === "done" ? "Captions ready" : "Captions failed"), j.status === "done" ? "ok" : "error");
  };

  const duplicate = async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created, updated, output, preview, status, captions, renderedAt, ...rest } = P;
    await newProject({ ...rest, title: `${P.title} (2)` });
  };

  return (
    <section className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* project bar */}
      <div className="flex items-center gap-2 px-3 sm:px-5 h-14 border-b border-border shrink-0">
        <select aria-label="Choose a Short to edit" className="input flex-1 min-w-0 sm:flex-none sm:max-w-[340px] font-medium" value={P.id} onChange={async (e) => { await flushSave(); setCurrentId(e.target.value); }}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title || "Untitled"}{p.status === "rendered" ? "  ·  rendered" : ""}</option>
          ))}
        </select>
        <button className="btn btn-primary shrink-0" aria-label="New Short" onClick={() => newProject({ template: P.template })}><Plus /> <span className="hidden min-[400px]:inline">New<span className="hidden sm:inline"> Short</span></span></button>
        <div className="ml-auto hidden md:flex items-center gap-1">
          <button className="btn btn-ghost" onClick={duplicate}><Copy /> Duplicate</button>
          <button className="btn btn-danger" onClick={() => confirm("Delete this Short?") && deleteProject(P.id)}><Trash2 /> Delete</button>
        </div>
        <div className="md:hidden shrink-0">
          <Menu trigger={<button className="btn btn-ghost btn-icon" aria-label="More actions"><MoreHorizontal /></button>}>
            <MenuItem icon={<Copy />} onClick={duplicate}>Duplicate this Short</MenuItem>
            <MenuItem icon={<Trash2 />} danger onClick={() => confirm("Delete this Short?") && deleteProject(P.id)}>Delete this Short</MenuItem>
          </Menu>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[860px] mx-auto px-3 sm:px-5 py-4 sm:py-5 flex flex-col gap-5">
          {/* text */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">
            <Field label="Header title" hint="Stays on screen">
              <input className="input h-10 text-[14px] font-medium" value={P.title} onChange={(e) => patchProject({ title: e.target.value })} placeholder="RANKING INSANE MOMENTS" />
            </Field>
            <Field label="Hook" hint={single && /#\d/.test(P.hook || "") ? <span className="text-warn">{/^wait for #1$/i.test((P.hook || "").trim()) ? "Hidden for single clips" : "Mentions a rank"}</span> : "First 1.6 s"}>
              <input className="input h-10 text-[14px]" value={P.hook || ""} onChange={(e) => patchProject({ hook: e.target.value })} placeholder="WAIT FOR #1" />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="btn" onClick={genMeta} disabled={!!aiBusy}>
              {aiBusy === "meta" ? <Loader2 className="animate-spin" /> : <Sparkles />} Title, description &amp; hashtags
            </button>
            <button className="btn" onClick={genCaps} disabled={!!aiBusy}>
              {aiBusy === "caps" ? <Loader2 className="animate-spin" /> : <Captions />} Auto-captions
            </button>
            {P.captionsOn && P.captions?.length ? (
              <span className="chip chip-accent">Captions on · {P.captions.length} words</span>
            ) : null}
          </div>

          {/* ranking */}
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-2">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">{single ? "Clip" : "Ranking"}</h2>
              <p className="text-[12px] text-muted">{single ? "Single clip — no rank numbers are shown. Add another clip to make it a ranking." : "Top card plays first. The bottom card is your #1."}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="chip"><ListOrdered className="size-3" /> {n} {n === 1 ? "clip" : "clips"}</span>
              <span className={`chip ${tooLong ? "chip-danger" : ""}`} title={tooLong ? `Over ${BRAND.maxShortSeconds}s — too long for Shorts` : ""}>
                <Clock3 className="size-3" /> {total.toFixed(1)}s
              </span>
            </div>
          </div>

          {!n ? (
            <Empty icon={<Plus />} title="No clips yet">
              <ol className="text-left list-decimal pl-4 space-y-1">
                <li>Add clips from your library (upload or paste a link).</li>
                <li>Put them in order — the last card becomes #1.</li>
                <li>Pick a style and render your Short.</li>
              </ol>
              {onAddClips && (
                <button className="btn btn-primary mt-4 lg:hidden" onClick={onAddClips}><FolderOpen /> Add clips</button>
              )}
            </Empty>
          ) : (
            <div className="flex flex-col gap-2">
              {P.items.map((it, i) => (
                <ClipCard
                  key={`${it.media}-${i}`}
                  it={it}
                  m={media.find((m) => m.id === it.media)}
                  rank={n - i}
                  single={single}
                  suggestions={[labelFromMediaName(media.find((m) => m.id === it.media)?.name), ...pastLabels, ...POPULAR_LABELS].filter(Boolean) as string[]}
                  isFirst={i === 0}
                  isLast={i === n - 1}
                  onChange={(patch) => setItem(i, patch)}
                  onRemove={() => patchProject((p) => ({ items: p.items.filter((_, k) => k !== i) }))}
                  onMove={(d) => move(i, i + d)}
                  dragging={dragFrom === i}
                  over={overIdx === i && dragFrom !== i}
                  dragProps={{
                    draggable: armed === i,
                    onMouseDown: (e) => setArmed((e.target as HTMLElement).closest("[data-handle]") ? i : null),
                    onDragStart: (e) => { setDragFrom(i); e.dataTransfer.effectAllowed = "move"; },
                    onDragEnd: () => { setDragFrom(null); setOverIdx(null); setArmed(null); },
                    onDragOver: (e) => { e.preventDefault(); setOverIdx(i); },
                    onDrop: (e) => { e.preventDefault(); if (dragFrom !== null) move(dragFrom, i); setDragFrom(null); setOverIdx(null); setArmed(null); },
                  }}
                />
              ))}
            </div>
          )}

          {n > 0 && (onAddClips || onRender) && (
            <div className="lg:hidden grid grid-cols-2 gap-2 pt-1 pb-2">
              {onAddClips && <button className="btn btn-lg" onClick={onAddClips}><Plus /> Add more</button>}
              {onRender && <button className="btn btn-lg btn-primary" onClick={onRender}>Style &amp; render <ArrowRight /></button>}
            </div>
          )}
        </div>
      </div>

      <MetaDialog meta={meta} onClose={() => setMeta(null)} />
    </section>
  );
}
