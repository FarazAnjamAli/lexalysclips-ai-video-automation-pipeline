import { BRAND_PATHS } from "@/lib/brand-paths";

export type Platform = keyof typeof BRAND_PATHS;

export const PLATFORMS: { id: Platform; name: string }[] = [
  { id: "tiktok", name: "TikTok" },
  { id: "youtube", name: "YouTube" },
  { id: "instagram", name: "Instagram" },
  { id: "x", name: "X" },
  { id: "facebook", name: "Facebook" },
];

export function detectPlatform(url?: string): Platform | null {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("twitter.com") || u.includes("x.com/")) return "x";
  if (u.includes("facebook.com") || u.includes("fb.watch")) return "facebook";
  return null;
}

/**
 * Official platform mark in its real brand colours.
 * `tile` draws it on its native background (e.g. black tile for TikTok).
 */
export function PlatformIcon({ platform, size = 16, tile = false, mono = false }: {
  platform: Platform; size?: number; tile?: boolean; mono?: boolean;
}) {
  const path = BRAND_PATHS[platform];
  const id = `ig-grad-${size}`;

  const glyph = (() => {
    if (mono) return <path d={path} fill="currentColor" />;
    switch (platform) {
      case "youtube":
        // red play-button with the white triangle showing through
        return <path d={path} fill="#FF0000" />;
      case "instagram":
        return (
          <>
            <defs>
              <radialGradient id={id} cx="30%" cy="107%" r="150%">
                <stop offset="0%" stopColor="#fdf497" />
                <stop offset="5%" stopColor="#fdf497" />
                <stop offset="45%" stopColor="#fd5949" />
                <stop offset="60%" stopColor="#d6249f" />
                <stop offset="90%" stopColor="#285AEB" />
              </radialGradient>
            </defs>
            <path d={path} fill={`url(#${id})`} />
          </>
        );
      case "tiktok":
        // the real mark: cyan + red offset shadows under a white note
        return (
          <>
            <path d={path} fill="#25F4EE" transform="translate(-0.7 -0.5)" />
            <path d={path} fill="#FE2C55" transform="translate(0.7 0.5)" />
            <path d={path} fill="#FFFFFF" />
          </>
        );
      case "x":
        return <path d={path} fill="#FFFFFF" />;
      case "facebook":
        return <path d={path} fill="#0866FF" />;
    }
  })();

  const svg = (
    <svg viewBox="-1 -1 26 26" width={tile ? size * 0.62 : size} height={tile ? size * 0.62 : size} aria-hidden>
      {glyph}
      {platform === "youtube" && !mono && <path d="M9.6 15.6V8.4l6.3 3.6z" fill="#fff" />}
    </svg>
  );

  if (!tile) return svg;
  const bg = platform === "youtube" ? "#fff" : platform === "facebook" ? "#fff" : "#000";
  return (
    <span className="inline-grid place-items-center rounded-[6px] shrink-0" style={{ width: size, height: size, background: bg }}>
      {svg}
    </span>
  );
}
