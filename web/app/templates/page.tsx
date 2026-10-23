"use client";

import { useEffect, useState } from "react";
import { Copy, Save, RotateCcw, Check, ArrowLeft } from "lucide-react";
import { api, splitName } from "@/lib/api";
import type { Template } from "@/lib/types";
import { useStudio } from "@/components/StudioProvider";
import { TemplatePreview } from "@/components/TemplatePreview";
import { Field, Segmented, Switch } from "@/components/ui";
import { MusicSelect } from "@/components/MusicSelect";

const TRANSITIONS = ["flash", "zoom", "glitch", "whip", "shake", "slideup", "cut"];
const SFX = ["", "whoosh_1", "whoosh_2", "impact_boom", "ui_pop", "bass_drop", "glitch", "text_swoosh"];
const COLOR_LABELS: Record<string, string> = {
  headerText: "Title text", headerStroke: "Title outline", headerBg: "Title box", accent: "Accent",
  listText: "List text", listNumber: "List numbers", badgeText: "Rank number", badgeStroke: "Rank outline",
  badgeBg: "Rank box", labelText: "Caption text", hookText: "Hook text",
};

const get = (o: unknown, p: string) => p.split(".").reduce<unknown>((a, k) => (a == null ? a : (a as Record<string, unknown>)[k]), o);
function setPath<T>(o: T, p: string, v: unknown): T {
  const c = structuredClone(o) as Record<string, unknown>;
  const ks = p.split("."); let a = c;
  ks.slice(0, -1).forEach((k) => { a[k] = (a[k] as Record<string, unknown>) || {}; a = a[k] as Record<string, unknown>; });
  a[ks[ks.length - 1]] = v;
  return c as T;
}

export default function TemplatesPage() {
  const { templates, fonts, reloadTemplates, toast, project, patchProject, media } = useStudio();
  // a real frame makes the previews easier to judge: use a clip from the current Short (or the library)
  const sampleMedia = media.find((m) => m.id === project?.items[0]?.media) || media[0];
  const sampleThumb = sampleMedia ? `/thumbs/${sampleMedia.thumb}` : null;
  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Template | null>(null);
  const [mobileEdit, setMobileEdit] = useState(false);
  const saved = templates.find((t) => t.id === selId) || null;
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    if (!selId && templates.length) setSelId(project?.template && templates.some((t) => t.id === project.template) ? project.template : templates[0].id);
  }, [templates, selId, project?.template]);
  useEffect(() => { if (saved) setDraft(structuredClone(saved)); }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id: string) => {
    if (dirty && !confirm("Discard unsaved template changes?")) return;
    setSelId(id); const t = templates.find((x) => x.id === id); if (t) setDraft(structuredClone(t));
    setMobileEdit(true);
  };
  const up = (p: string, v: unknown) => setDraft((d) => (d ? setPath(d, p, v) : d));
  const save = async () => {
    if (!draft) return;
    await api(`/api/templates/${draft.id}`, { method: "PUT", body: draft });
    await reloadTemplates();
    toast("Template saved. Render a preview in Studio to see it in motion.", "ok");
  };
  const duplicate = async () => {
    if (!draft) return;
    if (dirty) await save();
    const t = await api<Template>(`/api/templates/${draft.id}/duplicate`, { method: "POST" });
    await reloadTemplates(); setSelId(t.id); setDraft(t);
    toast("Duplicated. You're now editing the copy.", "ok");
  };

  // form helpers
  const num = (p: string, label: string, step = 1, hint?: string) => (
    <Field label={label} hint={hint}>
      <input className="input font-mono" type="number" step={step} value={(get(draft, p) as number) ?? ""} onChange={(e) => up(p, e.target.value === "" ? undefined : +e.target.value)} />
    </Field>
  );
  const select = (p: string, label: string, opts: string[], fmt = (o: string) => o || "None") => (
    <Field label={label}>
      <select className="input" value={(get(draft, p) as string) ?? ""} onChange={(e) => up(p, e.target.value)}>
        {opts.map((o) => <option key={o} value={o}>{fmt(o)}</option>)}
      </select>
    </Field>
  );
  const fontSel = (p: string, label: string) => (
    <Field label={label}>
      <select className="input" value={(get(draft, p) as string) ?? ""} onChange={(e) => up(p, e.target.value)} style={{ fontFamily: get(draft, p) as string }}>
        {fonts.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
      </select>
    </Field>
  );

  return (
    <main className="flex flex-col h-[calc(100dvh-48px)] lg:grid lg:grid-cols-[minmax(0,1fr)_600px] xl:grid-cols-[minmax(0,1fr)_680px]">
      {/* gallery */}
      <section className={`${mobileEdit ? "hidden" : "block"} lg:block flex-1 min-h-0 overflow-y-auto p-3 sm:p-6`}>
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight">Templates</h1>
            <p className="text-[12.5px] text-muted">{templates.length} styles. Tap one to edit it, or duplicate it to make your own.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
          {templates.map((t) => {
            const { title, sub } = splitName(t.name);
            const sel = t.id === selId;
            const inUse = t.id === project?.template;
            return (
              <button key={t.id} type="button" onClick={() => pick(t.id)}
                className={`group text-left flex flex-col gap-2 p-1.5 rounded-[10px] border transition-colors cursor-pointer
                  ${sel ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong bg-surface"}`}>
                <div className="relative">
                  <TemplatePreview T={sel && draft ? draft : t} title="TOP 5 MOMENTS" thumb={sampleThumb} className="pointer-events-none" />
                </div>
                <div className="px-1 pb-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12.5px] font-medium truncate">{title}</span>
                    {inUse && <span className="chip chip-accent h-4 px-1 text-[10px] shrink-0"><Check className="size-2.5" /> In use</span>}
                  </div>
                  <div className="text-[11px] text-faint truncate capitalize">{sub || `${t.layout} · ${t.transition}`}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* editor */}
      <section className={`${mobileEdit ? "flex" : "hidden"} lg:grid flex-col flex-1 min-h-0 overflow-y-auto lg:overflow-visible lg:border-l border-border bg-surface/40 lg:grid-cols-[250px_minmax(0,1fr)]`}>
        {draft ? (
          <>
            <div className="lg:hidden sticky top-0 z-20 flex items-center gap-2 px-2 h-14 border-b border-border bg-bg/95 backdrop-blur-md shrink-0">
              <button className="btn btn-ghost" onClick={() => { if (dirty && !confirm("Discard unsaved template changes?")) return; if (dirty && saved) setDraft(structuredClone(saved)); setMobileEdit(false); }}>
                <ArrowLeft /> All templates
              </button>
              <span className="flex-1 min-w-0 truncate text-[13px] font-medium">{splitName(draft.name).title}</span>
              <button className="btn btn-primary" onClick={save} disabled={!dirty}><Save /> Save</button>
            </div>
            <div className="p-4 lg:p-5 border-b lg:border-b-0 lg:border-r border-border flex flex-col gap-4 items-center">
              <TemplatePreview T={draft} width={210} title={project?.title || "TOP 5 INSANE MOMENTS"} thumb={sampleThumb} className="ring-1 ring-border-strong" />
              <div className="w-full flex flex-col gap-2">
                {dirty ? (
                  <button className="btn btn-primary w-full" onClick={save}><Save /> Save template</button>
                ) : (
                  <div className="h-8 grid place-items-center text-[12px] text-faint border border-border rounded-[var(--radius)]"><span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-accent" /> All changes saved</span></div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn" onClick={duplicate}><Copy /> Duplicate</button>
                  <button className="btn" onClick={() => saved && setDraft(structuredClone(saved))} disabled={!dirty}><RotateCcw /> Reset</button>
                </div>
                {project && project.template !== draft.id && (
                  <button className="btn btn-ghost w-full" onClick={() => patchProject({ template: draft.id })}>Use for current Short</button>
                )}
              </div>
            </div>

            <div className="lg:min-h-0 lg:overflow-y-auto p-4 lg:p-5 flex flex-col gap-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <Group title="General">
                <Field label="Name" className="col-span-2"><input className="input" value={draft.name} onChange={(e) => up("name", e.target.value)} /></Field>
                <Field label="Layout" className="col-span-2">
                  <Segmented value={draft.layout} onChange={(v) => up("layout", v)} options={[{ value: "full", label: "Full screen" }, { value: "boxed", label: "Boxed clip" }]} />
                </Field>
                {draft.layout === "boxed" && <>{num("boxTop", "Box top")}{num("boxHeight", "Box height")}</>}
                <ColorField label="Background" value={draft.bg} onChange={(v) => up("bg", v)} />
                {select("transition", "Transition", TRANSITIONS)}
                {num("topShade", "Top shade", 0.05, "0–1")}
                <div className="flex flex-col justify-end gap-2 pb-1">
                  <Switch checked={draft.progress !== false} onChange={(v) => up("progress", v)} label="Progress bar" />
                  <Switch checked={!!draft.outro} onChange={(v) => up("outro", v)} label="Outro card" />
                </div>
              </Group>

              <Group title="Fonts">
                {fontSel("fonts.header", "Title")}
                {fontSel("fonts.list", "List & captions")}
                {fontSel("fonts.badge", "Rank number")}
              </Group>

              <Group title="Colours" cols={3}>
                {Object.keys(draft.colors).map((k) => (
                  <ColorField key={k} label={COLOR_LABELS[k] || k} value={draft.colors[k]} onChange={(v) => up(`colors.${k}`, v)} />
                ))}
              </Group>

              <Group title="Title">
                <Field label="Style" className="col-span-2">
                  <Segmented value={draft.header.style} onChange={(v) => up("header.style", v)} options={[{ value: "stroke", label: "Outline" }, { value: "box", label: "Box" }, { value: "plain", label: "Plain" }]} />
                </Field>
                {num("header.size", "Size")}
                {num("header.y", "Y position")}
                {draft.header.style === "stroke" && num("header.strokeWidth", "Outline width")}
                <div className="flex items-end pb-1.5"><Switch checked={draft.header.uppercase !== false} onChange={(v) => up("header.uppercase", v)} label="Uppercase" /></div>
              </Group>

              <Group title="Ranking list">
                <div className="col-span-2"><Switch checked={draft.list.show !== false} onChange={(v) => up("list.show", v)} label="Show the ranking list" /></div>
                {num("list.size", "Text size")}
                {num("list.rowHeight", "Row height")}
                {num("list.x", "X position")}
                {num("list.y", "Y position")}
                {num("list.width", "Width")}
              </Group>

              <Group title="Rank number">
                {num("badge.size", "Size")}
                {num("badge.y", "Y offset")}
                {num("badge.hold", "Hold (seconds)", 0.05)}
                <div className="flex items-end pb-1.5"><Switch checked={!!draft.badge.box} onChange={(v) => up("badge.box", v)} label="Boxed" /></div>
              </Group>

              <Group title="Clip caption">
                <div className="col-span-2"><Switch checked={draft.caption.show !== false} onChange={(v) => up("caption.show", v)} label="Show each clip's label as a caption" /></div>
                {num("caption.size", "Size")}
                {num("caption.bottom", "Distance from bottom")}
              </Group>

              <Group title="Sound">
                <Field label="Default music" className="col-span-2"><MusicSelect value={draft.music || ""} onChange={(v) => up("music", v)} /></Field>
                {num("musicVolume", "Music volume", 0.05, "0–1")}
                {select("sfx.transition", "Transition SFX", SFX)}
                {select("sfx.reveal", "Reveal SFX", SFX)}
                {select("sfx.revealFinal", "#1 reveal SFX", SFX)}
              </Group>

              <Group title="Watermark">
                {num("watermark.opacity", "Opacity", 0.02, "0.1–0.3 is subtle")}
                {num("watermark.size", "Size")}
              </Group>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}

function Group({ title, children, cols = 2 }: { title: string; children: React.ReactNode; cols?: number }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="section-title pb-2 border-b border-border">{title}</h3>
      <div className={`grid gap-3 ${cols === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>{children}</div>
    </section>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <label className="flex items-center gap-2 h-8 pointer-coarse:h-10 px-1.5 rounded-[var(--radius)] border border-border bg-surface hover:border-border-strong cursor-pointer">
        <span className="relative size-5 rounded-[5px] ring-1 ring-white/15 overflow-hidden shrink-0" style={{ background: value }}>
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 opacity-0 cursor-pointer" />
        </span>
        <input className="w-full min-w-0 bg-transparent outline-none font-mono text-[11.5px] pointer-coarse:text-[16px] uppercase text-muted focus:text-text" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </Field>
  );
}
