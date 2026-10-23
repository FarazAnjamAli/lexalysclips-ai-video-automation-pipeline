"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, watchJob } from "@/lib/api";
import type { Job, Media, MusicTrack, Project, Template } from "@/lib/types";
import { BRAND } from "@/config/brand";

type Toast = { id: number; msg: string; kind: "info" | "ok" | "error" };
type RenderState = Job & { jobId: string; preview: boolean };

type Ctx = {
  ready: boolean;
  media: Media[]; templates: Template[]; music: MusicTrack[]; fonts: string[]; projects: Project[];
  project: Project | null; currentId: string | null; setCurrentId: (id: string) => void;
  patchProject: (patch: Partial<Project> | ((p: Project) => Partial<Project>)) => void;
  flushSave: () => Promise<void>; saving: boolean;
  newProject: (body?: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  reloadMedia: () => Promise<void>; reloadMusic: () => Promise<void>; reloadTemplates: () => Promise<Template[]>; reloadProjects: () => Promise<Project[]>;
  renders: Record<string, RenderState>; startRender: (pid: string, preview: boolean) => Promise<void>;
  toast: (msg: string, kind?: Toast["kind"]) => void; toasts: Toast[];
};

const StudioCtx = createContext<Ctx | null>(null);
export const useStudio = () => {
  const c = useContext(StudioCtx);
  if (!c) throw new Error("useStudio outside provider");
  return c;
};

const LS_KEY = "rankreel.currentProject";

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [music, setMusic] = useState<MusicTrack[]>([]);
  const [fonts, setFonts] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentId, setCurrentIdState] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [renders, setRenders] = useState<Record<string, RenderState>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dirty = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectsRef = useRef<Project[]>([]);
  projectsRef.current = projects;
  const currentIdRef = useRef<string | null>(null);
  currentIdRef.current = currentId;

  const toast = useCallback((msg: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);

  const reloadMedia = useCallback(async () => setMedia(await api<Media[]>("/api/media")), []);
  const reloadMusic = useCallback(async () => setMusic(await api<MusicTrack[]>("/api/music")), []);
  const reloadTemplates = useCallback(async () => {
    const t = await api<Template[]>("/api/templates");
    t.sort((a, b) => a.name.localeCompare(b.name));
    setTemplates(t);
    return t;
  }, []);
  const reloadProjects = useCallback(async () => {
    const p = await api<Project[]>("/api/projects");
    // keep unsaved local edits for dirty projects
    setProjects((cur) => p.map((np) => (dirty.current.has(np.id) ? cur.find((c) => c.id === np.id) || np : np)));
    return p;
  }, []);

  const setCurrentId = useCallback((id: string) => {
    setCurrentIdState(id);
    try { localStorage.setItem(LS_KEY, id); } catch {}
  }, []);

  // ---------------------------------------------------------------- saving
  const flushSave = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const ids = [...dirty.current];
    if (!ids.length) return;
    setSaving(true);
    for (const id of ids) {
      const p = projectsRef.current.find((x) => x.id === id);
      dirty.current.delete(id);
      if (!p) continue;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, ...body } = p;
      await api(`/api/projects/${id}`, { method: "PUT", body });
    }
    setSaving(false);
  }, []);

  const patchProject = useCallback<Ctx["patchProject"]>((patch) => {
    setProjects((list) =>
      list.map((p) => {
        if (p.id !== currentIdRef.current) return p;
        const ch = typeof patch === "function" ? patch(p) : patch;
        return { ...p, ...ch };
      })
    );
    if (currentIdRef.current) dirty.current.add(currentIdRef.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { flushSave(); }, 600);
  }, [flushSave]);
  const newProject = useCallback(async (body: Partial<Project> = {}) => {
    await flushSave();
    const p = await api<Project>("/api/projects", {
      method: "POST",
      body: { title: "RANKING INSANE MOMENTS", hook: "WAIT FOR #1", watermark: BRAND.defaultHandle, ...body },
    });
    await reloadProjects();
    setCurrentId(p.id);
  }, [flushSave, reloadProjects, setCurrentId]);

  const deleteProject = useCallback(async (id: string) => {
    dirty.current.delete(id);
    await api(`/api/projects/${id}`, { method: "DELETE" });
    const list = await reloadProjects();
    if (id === currentIdRef.current) {
      if (list.length) setCurrentId(list[0].id);
      else await newProject();
    }
  }, [reloadProjects, setCurrentId, newProject]);

  // ---------------------------------------------------------------- rendering
  const startRender = useCallback(async (pid: string, preview: boolean) => {
    await flushSave();
    const r = await api<{ job: string }>(`/api/render/${pid}`, { method: "POST", body: { preview } });
    setRenders((m) => ({ ...m, [pid]: { status: "queued", progress: 0, msg: "queued", jobId: r.job, preview } }));
    const j = await watchJob(r.job, (j) => setRenders((m) => ({ ...m, [pid]: { ...j, jobId: r.job, preview } })));
    setRenders((m) => ({ ...m, [pid]: { ...j, jobId: r.job, preview } }));
    await reloadProjects();
    const name = projectsRef.current.find((p) => p.id === pid)?.title || "Short";
    if (j.status === "done") toast(`${preview ? "Preview" : "Final render"} ready: ${name}`, "ok");
    else toast(`Render failed: ${j.msg || "unknown error"}`, "error");
  }, [flushSave, reloadProjects, toast]);

  // ---------------------------------------------------------------- boot
  useEffect(() => {
    (async () => {
      try {
        const [m, , mu, f, p] = await Promise.all([
          api<Media[]>("/api/media"), reloadTemplates(), api<MusicTrack[]>("/api/music"), api<string[]>("/api/fonts"),
          api<Project[]>("/api/projects"),
        ]);
        setMedia(m); setMusic(mu); setFonts(f); setProjects(p);
        let id: string | null = null;
        try { id = localStorage.getItem(LS_KEY); } catch {}
        if (!id || !p.find((x) => x.id === id)) id = p[0]?.id ?? null;
        if (id) setCurrentIdState(id);
        else {
          const np = await api<Project>("/api/projects", { method: "POST", body: { watermark: BRAND.defaultHandle } });
          setProjects([np]); setCurrentIdState(np.id);
        }
        setReady(true);
      } catch {
        toast("Can't reach the LexalysClips server on port 4545. Is it running?", "error");
      }
    })();
    const beforeUnload = () => { if (dirty.current.size) flushSave(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [reloadTemplates, toast, flushSave]);

  const project = useMemo(() => projects.find((p) => p.id === currentId) || null, [projects, currentId]);

  const value: Ctx = {
    ready, media, templates, music, fonts, projects, project, currentId, setCurrentId, patchProject, flushSave, saving,
    newProject, deleteProject, reloadMedia, reloadMusic, reloadTemplates, reloadProjects, renders, startRender, toast, toasts,
  };
  return <StudioCtx.Provider value={value}>{children}</StudioCtx.Provider>;
}
