"use client";

import { useEffect, useState } from "react";
import { FolderOpen, ListOrdered, Clapperboard, Loader2 } from "lucide-react";
import { MediaPanel } from "@/components/studio/MediaPanel";
import { Editor } from "@/components/studio/Editor";
import { LookPanel } from "@/components/studio/LookPanel";
import { useStudio } from "@/components/StudioProvider";

type Tab = "library" | "edit" | "look";
const TAB_KEY = "rankreel.studioTab";

/**
 * Desktop (lg+): three columns side by side.
 * Phone / tablet: one panel at a time with a bottom tab bar. Panels stay mounted
 * (just hidden) so uploads, downloads and renders keep running while you switch.
 */
export default function StudioPage() {
  const { project, renders, toast } = useStudio();
  const [tab, setTabState] = useState<Tab>("edit");
  useEffect(() => {
    try { const t = localStorage.getItem(TAB_KEY) as Tab | null; if (t === "library" || t === "edit" || t === "look") setTabState(t); } catch {}
  }, []);
  const setTab = (t: Tab) => {
    setTabState(t);
    try { localStorage.setItem(TAB_KEY, t); } catch {}
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  };

  const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
  const n = project?.items.length || 0;
  const r = project ? renders[project.id] : undefined;
  const rendering = !!r && (r.status === "queued" || r.status === "running");

  const show = (t: Tab) => `${tab === t ? "flex" : "hidden"} lg:flex flex-col min-h-0 min-w-0 flex-1 lg:flex-none`;

  return (
    <main className="flex flex-col h-[calc(100dvh-48px)] lg:grid lg:grid-cols-[260px_minmax(0,1fr)_320px] xl:grid-cols-[300px_minmax(0,1fr)_360px]">
      <div className={show("library")}>
        <MediaPanel onAdded={(name) => isMobile() && toast(`Added "${name}" to your Short. Open Edit to arrange it.`, "ok")} />
      </div>
      <div className={show("edit")}>
        <Editor onAddClips={() => setTab("library")} onRender={() => setTab("look")} />
      </div>
      <div className={show("look")}>
        <LookPanel />
      </div>

      {/* mobile tab bar */}
      <nav className="lg:hidden shrink-0 grid grid-cols-3 border-t border-border bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]" aria-label="Studio sections">
        <TabBtn active={tab === "library"} onClick={() => setTab("library")} icon={<FolderOpen />} label="Add clips" />
        <TabBtn active={tab === "edit"} onClick={() => setTab("edit")} icon={<ListOrdered />} label="Edit"
          badge={n ? <span className="chip chip-accent h-4 px-1 text-[10px]">{n}</span> : null} />
        <TabBtn active={tab === "look"} onClick={() => setTab("look")} icon={rendering ? <Loader2 className="animate-spin text-accent" /> : <Clapperboard />}
          label={rendering ? `Rendering ${Math.round((r?.progress || 0) * 100)}%` : "Style & render"} />
      </nav>
    </main>
  );
}

function TabBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? "page" : undefined}
      className={`relative flex flex-col items-center justify-center gap-1 h-[60px] text-[11px] font-medium cursor-pointer transition-colors [&_svg]:size-5 [&_svg]:stroke-[1.75]
        ${active ? "text-text" : "text-muted"}`}>
      {active && <span className="absolute top-0 left-6 right-6 h-0.5 rounded-b bg-accent" />}
      <span className="relative inline-flex items-center gap-1">{icon}{badge}</span>
      <span className="truncate max-w-full px-1">{label}</span>
    </button>
  );
}
