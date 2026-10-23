"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Zap, Clapperboard, Download, FolderOpen, Pencil, Music2, Loader2 } from "lucide-react";
import { api, isLocalHost, splitName } from "@/lib/api";
import { BRAND } from "@/config/brand";
import { useStudio } from "../StudioProvider";
import { TemplatePreview } from "../TemplatePreview";
import { Field, Progress, Segmented } from "../ui";
import { MusicSelect } from "../MusicSelect";

export function LookPanel() {
  const { project: P, templates, media, patchProject, renders, startRender } = useStudio();
  const [view, setView] = useState<"live" | "video">("live");
  const T = useMemo(() => templates.find((t) => t.id === P?.template) || templates[0], [templates, P?.template]);
  if (!P || !T) return <aside className="flex-1 lg:border-l border-border" />;

  const n = P.items.length;
  const shownRank = Math.min(3, Math.max(1, n));
  const shownItem = n ? P.items[n - shownRank] : null;
  const thumb = shownItem ? media.find((m) => m.id === shownItem.media)?.thumb : null;
  const labels = n ? P.items.map((it, i) => it.label || `Clip ${n - i}`) : undefined;

  const r = renders[P.id];
  const active = r && (r.status === "queued" || r.status === "running");
  const outFile = P.output || P.preview;
  const videoUrl = outFile ? `/output/${outFile}?v=${P.renderedAt || P.updated}` : null;
  const mv = P.musicVolume ?? T.musicVolume ?? 0.35;

  return (
    <aside className="flex-1 flex flex-col min-h-0 lg:border-l border-border bg-surface/40">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* preview */}
        <div className="p-4 border-b border-border flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Preview</h2>
            <div className="w-[150px]">
              <Segmented size="sm" value={view} onChange={setView}
                options={[{ value: "live", label: "Layout" }, { value: "video", label: "Render" }]} />
            </div>
          </div>
          <div className="flex justify-center">
            {view === "live" ? (
              <TemplatePreview T={T} width={210} title={P.title ?? ""} labels={labels} rank={shownRank}
                thumb={thumb ? `/thumbs/${thumb}` : null} className="ring-1 ring-border-strong" />
            ) : videoUrl ? (
              <video key={videoUrl} src={videoUrl} controls playsInline className="w-[210px] aspect-[9/16] rounded-[8px] bg-black ring-1 ring-border-strong object-contain" />
            ) : (
              <div className="w-[210px] aspect-[9/16] rounded-[8px] grid place-items-center text-center text-[12px] text-faint border border-dashed border-border-strong p-6">
                Render a preview to watch it here
              </div>
            )}
          </div>
        </div>

        {/* template grid */}
        <div className="p-4 border-b border-border flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Template</h2>
            <Link href="/templates/" className="btn btn-ghost btn-sm"><Pencil /> Edit</Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-2">
            {templates.map((t) => {
              const sel = t.id === P.template;
              const { title } = splitName(t.name);
              return (
                <button key={t.id} type="button" onClick={() => patchProject({ template: t.id })}
                  className={`group flex flex-col gap-1.5 p-1 rounded-[8px] border text-left transition-colors cursor-pointer
                    ${sel ? "border-accent bg-accent-soft" : "border-transparent hover:border-border-strong hover:bg-surface-2"}`}>
                  <TemplatePreview T={t} title="TOP 5" showBadge={false} thumb={thumb ? `/thumbs/${thumb}` : null} className="pointer-events-none !rounded-[5px]" />
                  <span className={`px-0.5 text-[11px] leading-tight truncate ${sel ? "text-text font-medium" : "text-muted group-hover:text-text"}`}>{title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* sound + text */}
        <div className="p-4 flex flex-col gap-4">
          <h2 className="section-title">Sound &amp; text</h2>
          <Field label={<span className="inline-flex items-center gap-1.5"><Music2 className="size-3" /> Music</span>}>
            <MusicSelect value={P.music || ""} onChange={(v) => patchProject({ music: v || null })} withDefault />
          </Field>
          <Field label="Music volume" hint={`${Math.round(mv * 100)}%`}>
            <input type="range" className="range" min={0} max={1} step={0.05} value={mv} onChange={(e) => patchProject({ musicVolume: +e.target.value })} />
          </Field>
          <Field label="Caption style">
            <Segmented value={P.captionStyle || "pop"} onChange={(v) => patchProject({ captionStyle: v })}
              options={[{ value: "pop", label: "Pop" }, { value: "box", label: "Boxed" }, { value: "clean", label: "Clean" }]} />
          </Field>
          <Field label="Watermark" hint="Light, drifting">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint">@</span>
              <input className="input pl-6" value={(P.watermark ?? BRAND.defaultHandle).replace(/^@/, "")} onChange={(e) => patchProject({ watermark: e.target.value })} />
            </div>
          </Field>
          <Field label="Outro / call to action" hint={T.outro ? "Shown at the end" : "Template outro is off"}>
            <input className="input" value={P.outroText || ""} onChange={(e) => patchProject({ outroText: e.target.value })} placeholder={BRAND.defaultOutro} />
          </Field>
        </div>
      </div>

      {/* render footer */}
      <div className="shrink-0 p-3 sm:p-4 border-t border-border bg-surface flex flex-col gap-2.5">
        {r && (r.status !== "done" || active) ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11.5px]">
              <span className={`inline-flex items-center gap-1.5 ${r.status === "error" ? "text-danger" : "text-muted"}`}>
                {active && <Loader2 className="size-3 animate-spin" />}
                {r.preview ? "Preview" : "Final"} · {r.status === "error" ? "failed" : r.msg || r.status}
              </span>
              {active && <span className="font-mono tabular-nums">{Math.round((r.progress || 0) * 100)}%</span>}
            </div>
            {active && <Progress value={r.progress || 0} />}
            {r.status === "error" && <p className="text-[11px] text-danger/90 break-words line-clamp-3">{r.msg}</p>}
          </div>
        ) : null}
        <div className="grid grid-cols-[1fr_1.4fr] gap-2">
          <button className="btn btn-lg" disabled={active || !n} onClick={() => { setView("video"); startRender(P.id, true); }}><Zap /> Quick preview</button>
          <button className="btn btn-lg btn-primary" disabled={active || !n} onClick={() => { setView("video"); startRender(P.id, false); }}><Clapperboard /> Render 1080×1920</button>
        </div>
        {outFile && (
          <div className="flex items-center gap-1">
            <a className="btn btn-sm flex-1 justify-start min-w-0" href={`/output/${outFile}`} download>
              <Download /> <span className="shrink-0">Download</span> <span className="truncate text-faint font-normal">{outFile}</span>
            </a>
            {isLocalHost() && <button className="btn btn-ghost btn-sm btn-icon" title="Open output folder" aria-label="Open output folder" onClick={() => api("/api/open-output", { method: "POST" })}><FolderOpen /></button>}
          </div>
        )}
      </div>
    </aside>
  );
}
