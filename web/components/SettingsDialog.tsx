"use client";

import { useEffect, useState } from "react";
import { KeyRound, ExternalLink, LogOut, Lock } from "lucide-react";
import { api } from "@/lib/api";
import type { Settings } from "@/lib/types";
import { Dialog, Field, Segmented } from "./ui";
import { useStudio } from "./StudioProvider";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useStudio();
  const [s, setS] = useState<Settings | null>(null);
  const [key, setKey] = useState("");
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!open) return;
    api<Settings>("/api/settings").then((x) => { setS(x); setKey(""); });
    api<{ required: boolean }>("/api/auth").then((a) => setLocked(!!a.required)).catch(() => {});
  }, [open]);

  const save = async () => {
    if (!s) return;
    const body: Partial<Settings> = { captionStyle: s.captionStyle, cookiesBrowser: s.cookiesBrowser };
    if (key.trim()) body.groqKey = key.trim();
    const r = await api<{ hasKey: boolean }>("/api/settings", { method: "PUT", body });
    toast(r.hasKey ? "Settings saved. AI tools are enabled." : "Settings saved. Add a Groq key to enable AI tools.", "ok");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Settings">
      {!s ? <div className="text-muted">Loading…</div> : (
        <div className="flex flex-col gap-5">
          <Field label="Groq API key" hint={s.groqKey ? <span className="text-accent">Key saved</span> : "Not set"}>
            <div className="relative">
              <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-faint" strokeWidth={1.75} />
              <input className="input pl-8 font-mono" type="password" value={key} onChange={(e) => setKey(e.target.value)}
                placeholder={s.groqKey ? "•••••••• (leave empty to keep)" : "gsk_…"} />
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted">
              Free key — powers AI titles and auto-captions. Stored only on the server.{" "}
              <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-accent hover:underline">
                Get one <ExternalLink className="size-3" />
              </a>
            </p>
          </Field>

          <Field label="Default caption style">
            <Segmented value={s.captionStyle || "pop"} onChange={(v) => setS({ ...s, captionStyle: v })}
              options={[{ value: "pop", label: "Pop" }, { value: "box", label: "Boxed" }, { value: "clean", label: "Clean" }]} />
          </Field>

          <Field label="Browser for Instagram login">
            <Segmented value={s.cookiesBrowser || "chrome"} onChange={(v) => setS({ ...s, cookiesBrowser: v })}
              options={[{ value: "chrome", label: "Chrome" }, { value: "edge", label: "Edge" }, { value: "firefox", label: "Firefox" }, { value: "brave", label: "Brave" }]} />
            <p className="mt-1.5 text-[11.5px] text-faint">Uses the browser on the computer running the server.</p>
          </Field>

          <div className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-surface-2 px-3 py-2.5">
            <Lock className="size-4 text-muted shrink-0" strokeWidth={1.75} />
            <div className="flex-1 min-w-0 text-[12px] text-muted leading-snug">
              {locked ? "Password protection is on. Only people with the password can open LexalysClips." : "No password set. Set RANKREEL_PASSWORD on the server to lock the app."}
            </div>
            {locked && (
              <button className="btn btn-sm shrink-0" onClick={async () => { await api("/api/logout", { method: "POST" }); window.location.href = "/login"; }}>
                <LogOut /> Sign out
              </button>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save settings</button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
