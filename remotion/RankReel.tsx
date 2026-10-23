import React, { useEffect, useState } from 'react';
import {
  AbsoluteFill, Audio, OffthreadVideo, Img, Sequence, continueRender, delayRender,
  interpolate, spring, useCurrentFrame, useVideoConfig, Easing,
} from 'remotion';

const FPS = 30;
export type Item = { src: string; in: number; out: number; label: string; muted?: boolean; volume?: number; isImage?: boolean };
export type Cap = { word: string; start: number; end: number };
export type Template = any;
export type Props = {
  title: string; hook?: string; items: Item[]; template: Template; assetsBase: string;
  music?: string | null; musicVolume?: number; watermark?: string; outroText?: string;
  captions?: Cap[]; captionStyle?: string;
};

const FONTS: Record<string, string> = {
  Anton: 'Anton-Regular.ttf', 'Bebas Neue': 'BebasNeue-Regular.ttf', Oswald: 'Oswald.ttf', Montserrat: 'Montserrat.ttf',
  'Archivo Black': 'ArchivoBlack-Regular.ttf', Bangers: 'Bangers-Regular.ttf',
};

export const HOOK_S = 1.6;
const BG_DOWN = 8; // backdrop blur downscale factor (render speed)
const OUTRO_S = 1.6;
export const itemFrames = (it: Item) => Math.max(15, Math.round((it.out - it.in) * FPS));
export const rankReelDuration = (p: Props) => {
  const sum = (p.items || []).reduce((a, it) => a + itemFrames(it), 0);
  return Math.max(30, sum + (p.template?.outro ? Math.round(OUTRO_S * FPS) : 0));
};

export const defaultProps: Props = {
  title: 'RANKING INSANE MOMENTS', hook: 'WAIT FOR #1', assetsBase: 'http://localhost:4545/assets', items: [],
  template: {}, music: null, musicVolume: 0.35, watermark: 'lexalysclips',
};

const useFonts = (base: string) => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all(Object.entries(FONTS).map(([name, file]) => {
      const f = new FontFace(name, `url(${base}/fonts/${file})`, name === 'Oswald' || name === 'Montserrat' ? { weight: '100 900' } : {});
      return f.load().then((ff) => { (document as any).fonts.add(ff); }).catch(() => null);
    })).then(() => continueRender(handle));
  }, []);
};

const strokeStyle = (color: string, w: number): React.CSSProperties => ({
  WebkitTextStroke: `${w}px ${color}`, paintOrder: 'stroke fill' as any,
});

// ---------------------------------------------------------------- pieces
const Clip: React.FC<{ it: Item; T: Template; dur: number; layout: string; first: boolean }> = ({ it, T, dur, layout, first }) => {
  const f = useCurrentFrame();
  const tr = T.transition || 'flash';
  const zoomBase = interpolate(f, [0, dur], [1.0, 1.07]);
  const punch = !first && (tr === 'zoom' || tr === 'flash') ? interpolate(f, [0, 8], [1.22, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }) : 1;
  const whipX = !first && tr === 'whip' ? interpolate(f, [0, 7], [1080, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }) : 0;
  const slideY = !first && tr === 'slideup' ? interpolate(f, [0, 8], [1920, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }) : 0;
  const shakeX = !first && tr === 'shake' && f < 14 ? Math.sin(f * 2.1) * (1 - f / 14) * 46 : 0;
  const jitter = !first && tr === 'glitch' && f < 7 ? (f % 2 ? 26 : -26) : 0;
  const media = (fit: 'cover' | 'contain', extra: React.CSSProperties = {}) => it.isImage
    ? <Img src={it.src} style={{ width: '100%', height: '100%', objectFit: fit, ...extra }} />
    : <OffthreadVideo src={it.src} trimBefore={Math.round(it.in * FPS)} trimAfter={Math.round(it.out * FPS)}
        muted={it.muted !== false} volume={it.volume ?? 1} style={{ width: '100%', height: '100%', objectFit: fit, ...extra }} />;
  if (layout === 'boxed') {
    const boxH = T.boxHeight || 760;
    return (
      <AbsoluteFill>
        {/* blurred backdrop: drawn at 1/8 size then scaled up — looks the same, ~60x cheaper to blur */}
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 1080 / BG_DOWN, height: 1920 / BG_DOWN, left: (1080 - 1080 / BG_DOWN) / 2, top: (1920 - 1920 / BG_DOWN) / 2,
            transform: `scale(${BG_DOWN * 1.25})`, filter: `blur(${38 / BG_DOWN}px) brightness(0.45) saturate(1.3)` }}>
            {it.isImage ? <Img src={it.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <OffthreadVideo src={it.src} trimBefore={Math.round(it.in * FPS)} trimAfter={Math.round(it.out * FPS)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
        </AbsoluteFill>
        <div style={{ position: 'absolute', left: 0, width: 1080, top: (T.boxTop ?? 640), height: boxH, overflow: 'hidden',
          transform: `translate(${whipX + jitter + shakeX}px, ${slideY}px) scale(${punch})`, borderTop: `6px solid ${T.colors.accent}`, borderBottom: `6px solid ${T.colors.accent}`, boxShadow: '0 30px 80px rgba(0,0,0,0.7)' }}>
          <div style={{ width: '100%', height: '100%', transform: `scale(${zoomBase})` }}>{media('cover')}</div>
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ transform: `translate(${whipX + jitter + shakeX}px, ${slideY}px) scale(${punch * zoomBase})` }}>{media('cover')}</AbsoluteFill>
  );
};

const Header: React.FC<{ T: Template; title: string }> = ({ T, title }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 12, stiffness: 140 } });
  const H = T.header || {}; const C = T.colors;
  if (!title || !title.trim()) return null; // no title -> show nothing (no empty box)
  const txt = H.uppercase === false ? title : title.toUpperCase();
  const base: React.CSSProperties = {
    fontFamily: T.fonts.header, fontSize: H.size || 92, lineHeight: 1.02, color: C.headerText, textAlign: 'center',
    letterSpacing: H.tracking ?? 1, padding: '0 50px', ...(H.style === 'stroke' ? strokeStyle(C.headerStroke || '#000', H.strokeWidth || 14) : {}),
    textShadow: H.style === 'stroke' ? '0 8px 24px rgba(0,0,0,0.6)' : 'none', fontWeight: H.weight || 400,
  };
  return (
    <div style={{ position: 'absolute', top: H.y ?? 110, left: 0, width: 1080, display: 'flex', justifyContent: 'center', transform: `scale(${0.6 + 0.4 * s})`, opacity: s }}>
      {H.style === 'box'
        ? <div style={{ ...base, background: C.headerBg, borderRadius: 18, padding: '18px 34px', margin: '0 50px', boxShadow: '0 16px 50px rgba(0,0,0,0.5)' }}>{txt}</div>
        : <div style={base}>{txt}</div>}
    </div>
  );
};

const RankList: React.FC<{ T: Template; items: Item[]; starts: number[] }> = ({ T, items, starts }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const L = T.list || {}; const C = T.colors; const n = items.length; if (L.show === false) return null;
  const rowH = L.rowHeight || 92; const top = L.y ?? 470;
  return (
    <div style={{ position: 'absolute', top, left: L.x ?? 46, width: L.width || 760 }}>
      {Array.from({ length: n }).map((_, r) => {
        // row r shows rank r+1 ; rank k plays at index n-k
        const idx = n - (r + 1); const st = starts[idx] + Math.round((T.badge?.hold ?? 0.55) * fps);
        const on = f >= st; const sp = spring({ frame: f - st, fps, config: { damping: 14, stiffness: 180 } });
        const current = f >= starts[idx] && (idx + 1 >= n || f < starts[idx + 1]);
        const lab = items[idx]?.label || ''; const maxW = (L.width || 760) - 110;
        const fs = Math.min(L.size || 58, Math.floor(maxW / Math.max(1, lab.length * 0.8)));  // auto-shrink long labels
        return (
          <div key={r} style={{ height: rowH, display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ fontFamily: T.fonts.badge, fontSize: (L.size || 58) * 1.05, color: current ? C.accent : C.listNumber, width: 86, textAlign: 'right',
              ...strokeStyle('#000', 9), textShadow: '0 4px 14px rgba(0,0,0,0.7)' }}>{r + 1}.</div>
            <div style={{ fontFamily: T.fonts.list, fontWeight: 900, fontSize: fs, color: current ? C.accent : C.listText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              ...strokeStyle('#000', 9), textShadow: '0 4px 14px rgba(0,0,0,0.7)', opacity: on ? sp : 0, transform: `translateX(${on ? (1 - sp) * -60 : -60}px)`, maxWidth: maxW,
              textTransform: L.uppercase === false ? 'none' : 'uppercase' }}>{lab}</div>
          </div>
        );
      })}
    </div>
  );
};

const Badge: React.FC<{ T: Template; rank: number }> = ({ T, rank }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const B = T.badge || {}; const C = T.colors;
  const hold = Math.round((B.hold ?? 0.55) * fps);
  const s = spring({ frame: f, fps, config: { damping: 9, stiffness: 220, mass: 0.7 } });
  const out = interpolate(f, [hold, hold + 7], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (out <= 0) return null;
  const size = B.size || 300;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', top: B.y ?? 120 }}>
      <div style={{ transform: `scale(${(B.style === 'slide' ? 1 : 2.2 - 1.2 * s) * (0.85 + 0.15 * out)}) rotate(${(1 - s) * -12}deg)`, opacity: out,
        fontFamily: T.fonts.badge, fontSize: size, lineHeight: 1, color: C.badgeText,
        background: B.box ? C.badgeBg : 'transparent', padding: B.box ? '10px 46px' : 0, borderRadius: 26,
        ...(B.box ? {} : strokeStyle(C.badgeStroke || '#000', 18)), textShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>#{rank}</div>
    </AbsoluteFill>
  );
};

const LabelCaption: React.FC<{ T: Template; label: string; dur: number }> = ({ T, label, dur }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const K = T.caption || {}; const C = T.colors;
  if (K.show === false || !label) return null;
  const st = Math.round((T.badge?.hold ?? 0.55) * fps);
  const s = spring({ frame: f - st, fps, config: { damping: 12, stiffness: 160 } });
  const words = label.toUpperCase().split(' ');
  const per = Math.max(3, Math.floor(10 / Math.max(1, words.length)));
  return (
    <div style={{ position: 'absolute', bottom: K.bottom ?? 300, width: 1080, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 18, padding: '0 70px',
      opacity: f >= st ? s : 0, transform: `scale(${0.7 + 0.3 * s})` }}>
      {words.map((w, i) => {
        const on = f >= st + i * per;
        return <span key={i} style={{ fontFamily: T.fonts.list, fontWeight: 900, fontSize: K.size || 76, color: on ? (i === Math.min(words.length - 1, Math.floor((f - st) / per)) ? C.accent : C.labelText) : 'transparent',
          ...strokeStyle('#000', 12), textShadow: on ? '0 6px 20px rgba(0,0,0,0.7)' : 'none' }}>{w}</span>;
      })}
    </div>
  );
};

const Flash: React.FC<{ T: Template }> = ({ T }) => {
  const f = useCurrentFrame(); const tr = T.transition || 'flash';
  if (tr === 'cut' || tr === 'whip' || tr === 'slideup' || tr === 'shake') return null;
  const o = interpolate(f, [0, tr === 'glitch' ? 4 : 6], [tr === 'glitch' ? 0.5 : 0.85, 0], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ background: tr === 'glitch' ? T.colors.accent : '#fff', opacity: o, mixBlendMode: tr === 'glitch' ? 'screen' : 'normal' }} />;
};

const Hook: React.FC<{ T: Template; text: string }> = ({ T, text }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const C = T.colors;
  const s = spring({ frame: f, fps, config: { damping: 8, stiffness: 200 } });
  const out = interpolate(f, [HOOK_S * fps - 8, HOOK_S * fps], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const shake = f < 10 ? Math.sin(f * 3) * 10 : 0;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', top: 260 }}>
      <div style={{ transform: `translateX(${shake}px) scale(${0.5 + 0.5 * s}) rotate(-3deg)`, opacity: out, background: C.accent, padding: '14px 40px', borderRadius: 14,
        fontFamily: T.fonts.badge, fontSize: 110, color: C.hookText || '#fff', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', maxWidth: 940 }}>{text.toUpperCase()}</div>
    </AbsoluteFill>
  );
};

const Watermark: React.FC<{ T: Template; text: string }> = ({ T, text }) => {
  const f = useCurrentFrame(); const { durationInFrames } = useVideoConfig(); const W = T.watermark || {};
  // slow drift around the frame so it can't simply be cropped out
  const t = f / Math.max(1, durationInFrames);
  const x = 80 + (Math.sin(t * Math.PI * 2 * 1.3) * 0.5 + 0.5) * 620;
  const y = 1340 + (Math.cos(t * Math.PI * 2 * 0.9) * 0.5 + 0.5) * 300;
  return <div style={{ position: 'absolute', left: x, top: y, fontFamily: 'Montserrat', fontWeight: 800, fontSize: W.size || 34, letterSpacing: 2,
    color: '#fff', opacity: W.opacity ?? 0.2, textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>@{text.replace(/^@/, '')}</div>;
};

const Progress: React.FC<{ T: Template; total: number }> = ({ T, total }) => {
  const f = useCurrentFrame(); if (T.progress === false) return null;
  return <div style={{ position: 'absolute', bottom: 0, left: 0, height: 10, width: `${(f / total) * 100}%`, background: T.colors.accent }} />;
};

// LexalysClips logo (same mark as the app favicon) — shown in the outro
const BrandLogo: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" style={{ filter: 'drop-shadow(0 0 18px rgba(198,244,50,.55)) drop-shadow(0 0 46px rgba(198,244,50,.25))', ...style }}>
    <rect width="32" height="32" rx="8" fill="#c6f432" />
    <rect x="5.5" y="17" width="4" height="8" rx="1.2" fill="#0a0b05" />
    <rect x="11" y="12.5" width="4" height="12.5" rx="1.2" fill="#0a0b05" />
    <path d="M17.5 7.8c0-.95 1.03-1.54 1.85-1.06l8.6 8.9c.75.5.75 1.6 0 2.1l-8.6 8.4c-.82.48-1.85-.11-1.85-1.06Z" fill="#0a0b05" />
  </svg>
);

// Brand outro — fixed LexalysClips colours (not the template's), so every Short ends the same way
const BRAND_LIME = '#c6f432'; const BRAND_BG = '#08080a'; const BRAND_TEXT = '#f5f5f0';
const Outro: React.FC<{ T: Template; text: string; handle: string }> = ({ text, handle }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const logoS = spring({ frame: f, fps, config: { damping: 11, stiffness: 140 } });
  const txtS = spring({ frame: f - 5, fps, config: { damping: 13, stiffness: 150 } });
  const hS = spring({ frame: f - 10, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 45% at 50% 46%, rgba(198,244,50,0.16), ${BRAND_BG} 70%)`, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 34 }}>
      <BrandLogo size={250} style={{ transform: `scale(${logoS}) rotate(${(1 - logoS) * -12}deg)`, opacity: logoS, marginBottom: 16 }} />
      <div style={{ fontFamily: 'Anton', fontSize: 104, lineHeight: 1.05, color: BRAND_TEXT, textAlign: 'center', letterSpacing: 2, padding: '0 80px',
        opacity: Math.max(0, txtS), transform: `translateY(${(1 - txtS) * 40}px)` }}>{text.toUpperCase()}</div>
      <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 58, color: BRAND_LIME, letterSpacing: 1, opacity: Math.max(0, hS),
        textShadow: '0 0 24px rgba(198,244,50,0.45)' }}>@{handle.replace(/^@/, '')}</div>
    </AbsoluteFill>
  );
};

// word-timed captions (karaoke style) spanning the whole timeline — driven by absolute time, not a Sequence
const Captions: React.FC<{ caps: Cap[]; style: string }> = ({ caps, style }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const t = f / fps;
  if (!caps || !caps.length) return null;
  const G = 3; // words shown per phrase chunk
  let gi = -1;
  for (let i = 0; i < caps.length; i += G) {
    const g = caps.slice(i, i + G);
    if (t >= g[0].start - 0.12 && t <= g[g.length - 1].end + 0.3) { gi = i; break; }
  }
  if (gi < 0) return null;
  const words = caps.slice(gi, gi + G); const box = style === 'box';
  return (
    <div style={{ position: 'absolute', bottom: 190, width: 1080, display: 'flex', justifyContent: 'center', gap: 16, padding: '0 70px', flexWrap: 'wrap' }}>
      {words.map((w, i) => {
        const on = t >= w.start - 0.02 && t <= w.end + 0.1;
        return (
          <span key={gi + i} style={{
            fontFamily: 'Archivo Black', fontWeight: 900, fontSize: 70, lineHeight: 1.1,
            color: box ? '#fff' : (on && style !== 'clean' ? '#FFE34D' : '#fff'),
            background: box ? (on ? 'rgba(227,25,55,0.95)' : 'rgba(0,0,0,0.78)') : 'transparent',
            padding: box ? '2px 14px' : 0, borderRadius: box ? 10 : 0,
            ...(box ? {} : strokeStyle('#000', 11)), textShadow: '0 5px 16px rgba(0,0,0,0.8)',
            transform: on ? 'translateY(-6px) scale(1.06)' : 'scale(1)',
          }}>{w.word.toUpperCase()}</span>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- main
export const RankReel: React.FC<Props> = (p) => {
  const T = p.template; const items = p.items || []; const n = items.length;
  useFonts(p.assetsBase);
  const { fps, durationInFrames } = useVideoConfig(); const f = useCurrentFrame();
  const starts: number[] = []; let acc = 0; items.forEach((it) => { starts.push(acc); acc += itemFrames(it); });
  const layout = T.layout || 'full';
  const sfx = (name: string) => `${p.assetsBase}/sfx/${name}.mp3`;
  const baseMv = p.musicVolume ?? T.musicVolume ?? 0.35;
  const musicVol = (fr: number) => {
    const c = starts.findIndex((s, i) => fr >= s && (i + 1 >= n || fr < starts[i + 1]));
    return baseMv * (c >= 0 && items[c] && items[c].muted === false ? 0.25 : 1);
  };
  return (
    <AbsoluteFill style={{ background: T.bg || '#000' }}>
      {items.map((it, i) => (
        <Sequence key={'c' + i} from={starts[i]} durationInFrames={itemFrames(it)}>
          <Clip it={it} T={T} dur={itemFrames(it)} layout={layout} first={i === 0} />
        </Sequence>
      ))}
      {/* readability gradients */}
      <AbsoluteFill style={{ background: `linear-gradient(to bottom, rgba(0,0,0,${T.topShade ?? 0.75}) 0%, rgba(0,0,0,0) ${layout === 'boxed' ? 34 : 46}%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.65) 100%)` }} />
      {/* header + rank list stop when the outro starts */}
      <Sequence from={0} durationInFrames={Math.max(1, acc)}>
        <Header T={T} title={p.title || ''} />
        {n > 1 && <RankList T={T} items={items} starts={starts} />}
      </Sequence>
      {items.map((it, i) => (
        <Sequence key={'b' + i} from={starts[i]} durationInFrames={itemFrames(it)}>
          {i > 0 && <Flash T={T} />}
          {n > 1 && <Badge T={T} rank={n - i} />}
          <LabelCaption T={T} label={it.label} dur={itemFrames(it)} />
          {i > 0 && T.sfx?.transition && <Audio src={sfx(T.sfx.transition)} volume={0.55} />}
          {T.sfx?.reveal && <Audio src={sfx(n - i === 1 ? (T.sfx.revealFinal || T.sfx.reveal) : T.sfx.reveal)} volume={0.5} />}
        </Sequence>
      ))}
      {p.hook && !(n === 1 && /^wait for #1$/i.test(p.hook.trim())) ? <Sequence from={0} durationInFrames={Math.round(HOOK_S * fps)}><Hook T={T} text={p.hook} /></Sequence> : null}
      {T.outro ? <Sequence from={acc} durationInFrames={Math.round(OUTRO_S * fps)}><Outro T={T} text={p.outroText || 'FOLLOW FOR MORE VIDEOS'} handle={p.watermark || 'lexalysclips'} /></Sequence> : null}
      {p.music ? <Audio src={p.music} volume={musicVol} loop /> : null}
      {p.captions && p.captions.length ? <Captions caps={p.captions} style={p.captionStyle || 'pop'} /> : null}
      <Progress T={T} total={durationInFrames} />
      {p.watermark ? <Watermark T={T} text={p.watermark} /> : null}
    </AbsoluteFill>
  );
};
