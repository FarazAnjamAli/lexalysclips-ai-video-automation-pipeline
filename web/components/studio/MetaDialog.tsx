"use client";

import { useState } from "react";
import { Check, Copy, CornerDownLeft } from "lucide-react";
import type { Meta } from "@/lib/types";
import { useStudio } from "../StudioProvider";
import { Dialog } from "../ui";

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="btn btn-sm btn-ghost" onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }}>
      {ok ? <Check className="text-accent" /> : <Copy />} {ok ? "Copied" : "Copy"}
    </button>
  );
}

function Row({ text, onUse, pre }: { text: string; onUse?: () => void; pre?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 rounded-[var(--radius)] border border-border bg-surface-2 px-3 py-2">
      <div className={`flex-1 min-w-0 text-[13px] leading-relaxed ${pre ? "whitespace-pre-wrap" : ""}`}>{text}</div>
      <div className="flex shrink-0 gap-1 sm:gap-0.5 justify-end">
        <CopyBtn text={text} />
        {onUse && <button className="btn btn-sm" onClick={onUse}><CornerDownLeft /> Use</button>}
      </div>
    </div>
  );
}

export function MetaDialog({ meta, onClose }: { meta: Meta | null; onClose: () => void }) {
  const { patchProject, toast } = useStudio();
  if (!meta) return null;
  const use = (patch: { title?: string; hook?: string }) => { patchProject(patch); toast("Applied to your Short", "ok"); };

  return (
    <Dialog open onClose={onClose} title="Title, description & hashtags" width={620}>
      <div className="flex flex-col gap-5">
        <p className="text-[11.5px] text-muted">
          {meta.note || (meta.source === "groq" ? "Generated with Groq AI." : "Built-in generator.")}
        </p>
        {meta.titles?.length ? (
          <section className="flex flex-col gap-1.5">
            <h3 className="label">Title options</h3>
            {meta.titles.map((t, i) => <Row key={i} text={t} onUse={() => use({ title: t })} />)}
          </section>
        ) : null}
        {meta.hook ? (
          <section className="flex flex-col gap-1.5">
            <h3 className="label">On-screen hook</h3>
            <Row text={meta.hook} onUse={() => use({ hook: meta.hook })} />
          </section>
        ) : null}
        {meta.description ? (
          <section className="flex flex-col gap-1.5">
            <h3 className="label">Description</h3>
            <Row text={meta.description} pre />
          </section>
        ) : null}
        {meta.hashtags?.length ? (
          <section className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <h3 className="label">Hashtags</h3>
              <CopyBtn text={meta.hashtags.map((h) => "#" + h.replace(/^#/, "")).join(" ")} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {meta.hashtags.map((h) => <span key={h} className="chip h-6 px-2 text-[12px]">#{h.replace(/^#/, "")}</span>)}
            </div>
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}
