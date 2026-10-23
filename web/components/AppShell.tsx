"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Clapperboard, LayoutGrid, ListVideo, Settings2, CheckCircle2, AlertCircle, Info, Loader2 } from "lucide-react";
import { BRAND } from "@/config/brand";
import { useStudio } from "./StudioProvider";
import { SettingsDialog } from "./SettingsDialog";
import { LogoMark } from "./Logo";

const NAV = [
  { href: "/", label: "Studio", icon: Clapperboard },
  { href: "/templates/", label: "Templates", icon: LayoutGrid },
  { href: "/queue/", label: "Queue", icon: ListVideo },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { projects, media, toasts, saving, ready } = useStudio();
  const [settings, setSettings] = useState(false);
  const drafts = projects.filter((p) => p.status !== "rendered").length;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 h-12 flex items-center gap-2 sm:gap-6 pl-3 pr-1.5 sm:px-4 border-b border-border bg-bg/85 backdrop-blur-md">
        {/* logo + wordmark */}
        <Link href="/" className="flex items-center gap-2 shrink-0" aria-label={`${BRAND.name} home`}>
          <LogoMark size={24} />
          <span className="hidden min-[420px]:inline text-[15px] font-semibold tracking-[-0.03em]">{BRAND.name.toLowerCase()}</span>
          <span className="hidden xl:inline text-[11px] text-faint">{BRAND.tagline}</span>
        </Link>

        <nav className="flex items-center gap-0.5 min-w-0">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, ""));
            return (
              <Link key={href} href={href}
                className={`relative inline-flex items-center gap-1.5 h-9 sm:h-8 px-2 sm:px-3 rounded-[var(--radius)] text-[12.5px] font-medium transition-colors
                  ${active ? "text-text bg-surface-2" : "text-muted hover:text-text"}`}>
                <Icon className="hidden sm:block size-3.5" strokeWidth={1.75} />
                {label}
                {label === "Queue" && drafts > 0 && <span className="chip h-4 px-1 text-[10px]">{drafts}</span>}
                {active && <span className="absolute -bottom-[7px] sm:-bottom-[9px] left-2 right-2 sm:left-3 sm:right-3 h-px bg-accent" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <span className="hidden sm:flex items-center gap-1.5 text-[11.5px] text-faint tabular-nums">
            {saving ? <><Loader2 className="size-3 animate-spin" /> Saving</> : ready ? <><span className="size-1.5 rounded-full bg-accent" /> Saved</> : "Connecting"}
          </span>
          <span className="hidden lg:inline text-[11.5px] text-faint tabular-nums">{media.length} clips · {projects.length} shorts</span>
          <button className="btn btn-ghost btn-icon" onClick={() => setSettings(true)} title="Settings" aria-label="Settings"><Settings2 /></button>
        </div>
      </header>

      <div className="flex-1 min-h-0">{children}</div>

      <SettingsDialog open={settings} onClose={() => setSettings(false)} />

      {/* toasts */}
      <div className="fixed z-[80] flex flex-col gap-2 left-3 right-3 bottom-[calc(72px+env(safe-area-inset-bottom))] sm:left-auto sm:right-4 sm:w-[340px] lg:bottom-4 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`pointer-events-auto panel flex items-start gap-2.5 px-3.5 py-3 text-[12.5px] shadow-xl shadow-black/50 bg-surface-2
            ${t.kind === "error" ? "border-[rgba(255,90,95,.35)]" : t.kind === "ok" ? "border-[var(--accent-line)]" : ""}`}>
            {t.kind === "error" ? <AlertCircle className="size-4 text-danger shrink-0 mt-px" strokeWidth={1.75} />
              : t.kind === "ok" ? <CheckCircle2 className="size-4 text-accent shrink-0 mt-px" strokeWidth={1.75} />
              : <Info className="size-4 text-muted shrink-0 mt-px" strokeWidth={1.75} />}
            <span className="leading-snug break-words min-w-0">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
