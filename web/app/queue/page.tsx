"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, FolderOpen, Download, Pencil, Loader2, CheckCircle2, CircleDashed, AlertCircle, Play } from "lucide-react";
import { api, isLocalHost, splitName, totalLen } from "@/lib/api";
import type { RenderJob } from "@/lib/types";
import { useStudio } from "@/components/StudioProvider";
import { Empty, Progress, Segmented } from "@/components/ui";

export default function QueuePage() {
  const { projects, templates, media, setCurrentId, startRender, reloadProjects, renders } = useStudio();
  const router = useRouter();
  const [server, setServer] = useState<RenderJob[]>([]);
  const [filter, setFilter] = useState<"all" | "draft" | "rendered">("all");

  // also pick up renders started elsewhere (other tabs / earlier)
  useEffect(() => {
    let alive = true;
    const tick = async () => { const r = await api<RenderJob[]>("/api/renders"); if (alive) setServer(r); };
    tick(); reloadProjects();
    const t = setInterval(tick, 2500);
    return () => { alive = false; clearInterval(t); };
  }, [reloadProjects]);

  const live = useMemo(() => {
    const m: Record<string, RenderJob> = {};
    server.filter((r) => r.status === "running" || r.status === "queued").forEach((r) => { if (r.project) m[r.project] = r; });
    Object.entries(renders).forEach(([pid, r]) => { if (r.status === "running" || r.status === "queued") m[pid] = { ...r, id: r.jobId }; });
    return m;
  }, [server, renders]);

  const list = projects.filter((p) => filter === "all" || (filter === "rendered" ? p.status === "rendered" : p.status !== "rendered"));
  const drafts = projects.filter((p) => p.status !== "rendered" && p.items.length);

  const open = (id: string) => { setCurrentId(id); router.push("/"); };
  const renderAll = () => drafts.forEach((p) => { if (!live[p.id]) startRender(p.id, false); });

  return (
    <main className="h-[calc(100dvh-48px)] overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col gap-4 sm:gap-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight">Queue</h1>
            <p className="text-[12.5px] text-muted">{projects.length} Shorts · {drafts.length} ready to render</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-[240px]">
              <Segmented size="sm" value={filter} onChange={setFilter}
                options={[{ value: "all", label: "All" }, { value: "draft", label: "Drafts" }, { value: "rendered", label: "Rendered" }]} />
            </div>
            {isLocalHost() && <button className="btn" onClick={() => api("/api/open-output", { method: "POST" })}><FolderOpen /> Output folder</button>}
            <button className="btn btn-primary flex-1 sm:flex-none" onClick={renderAll} disabled={!drafts.length}><Clapperboard /> Render all drafts</button>
          </div>
        </div>

        {!list.length ? (
          <Empty icon={<Clapperboard />} title="Nothing here yet">Shorts you create in the Studio show up in this list.</Empty>
        ) : (
          <div className="panel overflow-hidden">
            <div className="hidden md:grid grid-cols-[64px_minmax(0,1fr)_150px_90px_160px_120px] items-center gap-4 px-4 h-9 border-b border-border text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
              <span /> <span>Short</span> <span>Template</span> <span>Length</span> <span>Status</span> <span className="text-right">Actions</span>
            </div>
            {list.map((p) => {
              const T = templates.find((t) => t.id === p.template);
              const first = p.items[p.items.length - 1];
              const thumb = first ? media.find((m) => m.id === first.media)?.thumb : null;
              const lv = live[p.id];
              const lastErr = renders[p.id]?.status === "error";
              return (
                <div key={p.id} className="grid grid-cols-[48px_minmax(0,1fr)] md:grid-cols-[64px_minmax(0,1fr)_150px_90px_160px_120px] items-center gap-x-3 gap-y-2.5 md:gap-4 px-3 md:px-4 py-3 border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors">
                  <div className="w-12 aspect-[9/16] rounded-[5px] overflow-hidden bg-surface-3 ring-1 ring-border row-span-2 md:row-span-1 self-start md:self-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {thumb && <img src={`/thumbs/${thumb}`} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <button className="text-left min-w-0 cursor-pointer" onClick={() => open(p.id)}>
                    <div className="text-[13px] font-medium truncate hover:text-accent transition-colors">{p.title || "Untitled"}</div>
                    <div className="text-[11.5px] text-faint">{p.items.length} clips<span className="md:hidden"> · {totalLen(p.items).toFixed(1)}s · {T ? splitName(T.name).title : p.template}</span> · edited {new Date(p.updated).toLocaleDateString()}</div>
                  </button>
                  <span className="hidden md:block text-[12px] text-muted truncate">{T ? splitName(T.name).title : p.template}</span>
                  <span className="hidden md:block text-[12px] font-mono tabular-nums text-muted">{totalLen(p.items).toFixed(1)}s</span>
                  <div className="flex flex-col gap-1.5">
                    {lv ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-accent">
                          <Loader2 className="size-3.5 animate-spin" /> {lv.status === "queued" ? "Queued" : `Rendering ${Math.round((lv.progress || 0) * 100)}%`}
                        </span>
                        <Progress value={lv.progress || 0} />
                      </>
                    ) : lastErr ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-danger" title={renders[p.id]?.msg}><AlertCircle className="size-3.5" /> Failed</span>
                    ) : p.status === "rendered" ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-text"><CheckCircle2 className="size-3.5 text-accent" /> Rendered</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-muted"><CircleDashed className="size-3.5" /> Draft</span>
                    )}
                  </div>
                  <div className="col-span-2 md:col-span-1 flex flex-wrap md:flex-nowrap md:justify-end gap-1.5 md:gap-0.5">
                    {p.output ? (
                      <>
                        <a className="btn btn-sm md:w-7 md:px-0 md:bg-transparent md:border-transparent md:text-muted md:hover:text-text md:hover:bg-surface-2" href={`/output/${p.output}`} target="_blank" rel="noreferrer" title="Watch"><Play /><span className="md:hidden">Watch</span></a>
                        <a className="btn btn-sm md:w-7 md:px-0 md:bg-transparent md:border-transparent md:text-muted md:hover:text-text md:hover:bg-surface-2" href={`/output/${p.output}`} download title="Download"><Download /><span className="md:hidden">Download</span></a>
                      </>
                    ) : (
                      <button className="btn btn-sm md:w-7 md:px-0 md:bg-transparent md:border-transparent md:text-muted md:hover:text-text md:hover:bg-surface-2" title="Render" disabled={!!lv || !p.items.length} onClick={() => startRender(p.id, false)}><Clapperboard /><span className="md:hidden">Render</span></button>
                    )}
                    <button className="btn btn-sm md:w-7 md:px-0 md:bg-transparent md:border-transparent md:text-muted md:hover:text-text md:hover:bg-surface-2" title="Edit" onClick={() => open(p.id)}><Pencil /><span className="md:hidden">Edit</span></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
