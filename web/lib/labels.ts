// Label suggestions for clip cards. Edit POPULAR_LABELS to add your own go-to phrases.
export const POPULAR_LABELS = [
  "Unreal finish", "No-look pass", "Last-second winner", "Bicycle kick", "Insane skill move", "Crowd goes wild",
  "Perfect timing", "Craziest save", "Ankle breaker", "Game winner", "Legendary moment", "Unbelievable goal",
  "Clutch play", "Pure disrespect", "Calmest ever", "Biggest comeback", "Most expensive", "Fastest ever",
  "World record", "Rarest moment", "Funniest fail", "Didn't see that coming", "Instant karma", "Wait for it",
  "Too smooth", "Outplayed", "Mic drop moment", "Top-bins finish", "Free-kick magic", "Solo goal",
  "Last-minute drama", "Iconic celebration", "Big brain play", "Lucky escape", "Cold-blooded", "GOAT moment",
  "Plot twist", "Most viewed", "Most satisfying", "Scariest moment", "Smartest move", "Best reaction",
  "Peak performance", "Hall of fame", "Never forget", "Shock result", "Speed demon", "Pure class",
];

const JUNK = /^(ssstik|snaptik|tiktok|savetik|musicaldown|download|video|vid|img|image|screen ?recording|untitled|copy of)\b/i;

/** Turn a clip's file/video title into a usable label, or "" if it's just a filename. */
export function labelFromMediaName(name?: string): string {
  if (!name) return "";
  let s = name
    .replace(/\.(mp4|mov|webm|mkv|m4v|jpe?g|png|webp)$/i, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[#@][\p{L}\p{N}_.]+/gu, "")
    .replace(/[\p{Extended_Pictographic}‍️]/gu, "")
    .replace(/[_|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[-–—:,.\s]+$/, "");
  if (!s || JUNK.test(s) || !/[a-z]{3,}/i.test(s) || /^\d[\d\s._-]*$/.test(s)) return "";
  if (s.length > 40) s = s.slice(0, 40).replace(/\s+\S*$/, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Rank candidate labels for what's typed so far. */
export function matchLabels(typed: string, pool: string[], limit = 6): string[] {
  const q = typed.trim().toLowerCase();
  const seen = new Set<string>(); const out: string[] = [];
  const push = (x: string) => { const k = x.toLowerCase(); if (!x || seen.has(k) || k === q) return; seen.add(k); out.push(x); };
  if (!q) { pool.forEach(push); return out.slice(0, limit); }
  pool.filter((x) => x.toLowerCase().startsWith(q)).forEach(push);
  pool.filter((x) => x.toLowerCase().split(/\s+/).some((w) => w.startsWith(q))).forEach(push);
  pool.filter((x) => x.toLowerCase().includes(q)).forEach(push);
  return out.slice(0, limit);
}
