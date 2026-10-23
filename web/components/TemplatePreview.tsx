"use client";

import { useEffect, useRef, useState } from "react";
import type { Template } from "@/lib/types";

/**
 * Live mock of a Short frame, drawn on a 1080×1920 canvas and scaled down.
 * Uses the same numbers the video engine (remotion/RankReel.tsx) uses, so what you see
 * here lines up with the final render.
 */
export function TemplatePreview({
  T, width, title = "TOP 5 INSANE MOMENTS", labels, thumb, rank = 3, showBadge = true, hook, className = "",
}: {
  T: Template; width?: number; title?: string; labels?: string[]; thumb?: string | null;
  rank?: number; showBadge?: boolean; hook?: string; className?: string;
}) {
  // width omitted = fill the parent's width (measured)
  const box = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(width || 160);
  useEffect(() => {
    if (width || !box.current) return;
    const ro = new ResizeObserver(([e]) => setMeasured(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [width]);
  const w = width || measured;
  const s = w / 1080;
  const C = T.colors || ({} as Template["colors"]);
  const H = T.header || ({} as Template["header"]);
  const L = T.list || ({} as Template["list"]);
  const B = T.badge || ({} as Template["badge"]);
  const K = T.caption || ({} as Template["caption"]);
  const boxed = T.layout === "boxed";
  const single = labels?.length === 1; // single-clip Short: no list, no rank number
  const rows = Math.max(3, Math.min(labels?.length || 5, 10));
  const sample = labels && labels.length ? labels : ["Unreal finish", "No-look pass", "Crowd goes wild", "Last second", "Legendary"];
  // labels[] is in play order (highest rank first); list row r shows rank r+1
  const labelForRank = (r: number) => sample[sample.length - r] ?? "";
  const currentRank = single ? 1 : Math.min(rank, rows);
  const stroke = (color: string, w: number): React.CSSProperties => ({ WebkitTextStroke: `${w}px ${color}`, paintOrder: "stroke fill" });
  const headerTxt = H.uppercase === false ? title : title.toUpperCase();

  const media = thumb ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
  ) : (
    <div className="absolute inset-0" style={{ background: `radial-gradient(120% 70% at 50% 45%, ${C.accent}33 0%, transparent 60%), linear-gradient(160deg, #2a2a30 0%, #121215 55%, #0b0b0d 100%)` }} />
  );

  const headerBase: React.CSSProperties = {
    fontFamily: T.fonts?.header, fontSize: H.size || 92, lineHeight: 1.02, color: C.headerText, textAlign: "center",
    letterSpacing: H.tracking ?? 1, fontWeight: H.weight || 400,
    ...(H.style === "stroke" ? stroke(C.headerStroke || "#000", H.strokeWidth || 14) : {}),
    textShadow: H.style === "stroke" ? "0 8px 24px rgba(0,0,0,0.6)" : "none",
  };

  return (
    <div ref={box} className={`relative overflow-hidden rounded-[8px] bg-black ${className}`} style={{ width: width || "100%", aspectRatio: "9 / 16" }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: 1080, height: 1920, transform: `scale(${s})`, background: T.bg || "#000" }}>
        {/* clip */}
        {boxed ? (
          <>
            <div className="absolute inset-0 scale-125" style={{ filter: "blur(38px) brightness(0.45) saturate(1.3)" }}>{media}</div>
            <div className="absolute left-0 overflow-hidden" style={{ width: 1080, top: T.boxTop ?? 640, height: T.boxHeight || 760, borderTop: `6px solid ${C.accent}`, borderBottom: `6px solid ${C.accent}` }}>
              {media}
            </div>
          </>
        ) : (
          media
        )}

        {/* readability shade */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, rgba(0,0,0,${T.topShade ?? 0.75}) 0%, rgba(0,0,0,0) ${boxed ? 34 : 46}%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.65) 100%)` }} />

        {/* header */}
        {headerTxt.trim() ? <div className="absolute left-0 flex justify-center" style={{ top: H.y ?? 110, width: 1080 }}>
          {H.style === "box" ? (
            <div style={{ ...headerBase, background: C.headerBg, borderRadius: 18, padding: "18px 34px", margin: "0 50px" }}>{headerTxt}</div>
          ) : (
            <div style={{ ...headerBase, padding: "0 50px" }}>{headerTxt}</div>
          )}
        </div> : null}

        {/* ranking list */}
        {L.show !== false && !single && (
          <div className="absolute" style={{ top: L.y ?? 470, left: L.x ?? 46, width: L.width || 760 }}>
            {Array.from({ length: rows }).map((_, r) => {
              const rk = r + 1;
              const current = rk === currentRank;
              const revealed = rk >= currentRank;
              const lab = labelForRank(rk);
              const maxW = (L.width || 760) - 110;
              const fs = Math.min(L.size || 58, Math.floor(maxW / Math.max(1, lab.length * 0.8)));
              return (
                <div key={r} className="flex items-center" style={{ height: L.rowHeight || 92, gap: 18 }}>
                  <div style={{ fontFamily: T.fonts?.badge, fontSize: (L.size || 58) * 1.05, color: current ? C.accent : C.listNumber, width: 86, textAlign: "right", ...stroke("#000", 9) }}>{rk}.</div>
                  <div style={{ fontFamily: T.fonts?.list, fontWeight: 900, fontSize: fs, color: current ? C.accent : C.listText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: maxW, opacity: revealed ? 1 : 0, textTransform: L.uppercase === false ? "none" : "uppercase", ...stroke("#000", 9) }}>
                    {lab}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* big rank number */}
        {showBadge && !single && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ top: B.y ?? 120 }}>
            <div style={{ fontFamily: T.fonts?.badge, fontSize: B.size || 300, lineHeight: 1, color: C.badgeText, background: B.box ? C.badgeBg : "transparent", padding: B.box ? "10px 46px" : 0, borderRadius: 26, ...(B.box ? {} : stroke(C.badgeStroke || "#000", 18)), textShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
              #{currentRank}
            </div>
          </div>
        )}

        {/* hook */}
        {hook ? (
          <div className="absolute inset-0 flex items-center justify-center" style={{ top: 260 }}>
            <div style={{ transform: "rotate(-3deg)", background: C.accent, padding: "14px 40px", borderRadius: 14, fontFamily: T.fonts?.badge, fontSize: 110, color: C.hookText || "#fff", maxWidth: 940, textAlign: "center" }}>
              {hook.toUpperCase()}
            </div>
          </div>
        ) : null}

        {/* label caption */}
        {K.show !== false && labelForRank(currentRank) && (
          <div className="absolute flex justify-center flex-wrap" style={{ bottom: K.bottom ?? 300, width: 1080, gap: 18, padding: "0 70px" }}>
            {labelForRank(currentRank).toUpperCase().split(" ").map((w, i, a) => (
              <span key={i} style={{ fontFamily: T.fonts?.list, fontWeight: 900, fontSize: K.size || 76, color: i === a.length - 1 ? C.accent : C.labelText, ...stroke("#000", 12) }}>{w}</span>
            ))}
          </div>
        )}

        {/* progress bar */}
        {T.progress !== false && <div className="absolute bottom-0 left-0" style={{ height: 10, width: "58%", background: C.accent }} />}
      </div>
    </div>
  );
}
