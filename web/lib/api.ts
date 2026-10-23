import type { Job } from "./types";

/** Small JSON fetch helper for the Rankreel server (same origin). */
export async function api<T = unknown>(url: string, opt: { method?: string; body?: unknown } = {}): Promise<T> {
  const isForm = opt.body instanceof FormData;
  const r = await fetch(url, {
    method: opt.method || (opt.body ? "POST" : "GET"),
    headers: isForm || !opt.body ? undefined : { "Content-Type": "application/json" },
    body: opt.body === undefined ? undefined : isForm ? (opt.body as FormData) : JSON.stringify(opt.body),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && data && (data as { auth?: boolean }).auth && typeof window !== "undefined") {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!r.ok && data && typeof data === "object" && !("error" in data)) (data as Record<string, unknown>).error = `HTTP ${r.status}`;
  return data as T;
}

/** Poll a long-running server job until it finishes. */
export function watchJob(id: string, onTick?: (j: Job) => void, everyMs = 1000): Promise<Job> {
  return new Promise((resolve) => {
    const t = setInterval(async () => {
      let j: Job;
      try { j = await api<Job>(`/api/jobs/${id}`); } catch { return; }
      onTick?.(j);
      if (j.status === "done" || j.status === "error" || j.status === "unknown") { clearInterval(t); resolve(j); }
    }, everyMs);
  });
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
export const clipLen = (it: { in: number; out: number }) => Math.max(0.5, (+it.out || 0) - (+it.in || 0));
export const totalLen = (items: { in: number; out: number }[]) => items.reduce((a, it) => a + clipLen(it), 0);

/** "Fire Rank (viral classic)" -> { title: "Fire Rank", sub: "viral classic" } */
export function splitName(name: string) {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(name || "");
  return m ? { title: m[1], sub: m[2] } : { title: name, sub: "" };
}

/** True when the app is opened on the machine running the server (so "open folder" makes sense). */
export const isLocalHost = () =>
  typeof window !== "undefined" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
