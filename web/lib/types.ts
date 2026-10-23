export type Media = {
  id: string; name: string; file: string; duration: number; width?: number; height?: number;
  hasAudio?: boolean; keepAudio?: boolean; isImage?: boolean; thumb: string; source: string; added: number;
};

/** One clip in a Short. `muted: false` = keep the clip's original sound. */
export type Item = { media: string; in: number; out: number; label: string; muted: boolean; volume?: number };

export type Caption = { word: string; start: number; end: number };

export type Project = {
  id: string; title: string; hook?: string; template: string; items: Item[];
  music: string | null; musicVolume: number | null; watermark?: string; outroText?: string;
  captionStyle?: string; captions?: Caption[]; captionsOn?: boolean;
  status: "draft" | "rendered" | string; output?: string; preview?: string;
  created: number; updated: number; renderedAt?: number;
};

export type Template = {
  id: string; name: string; layout: "full" | "boxed"; bg: string;
  boxTop?: number; boxHeight?: number;
  fonts: { header: string; list: string; badge: string };
  colors: {
    headerText: string; headerStroke: string; headerBg: string; accent: string; listText: string;
    listNumber: string; badgeText: string; badgeStroke: string; badgeBg: string; labelText: string; hookText: string;
    [k: string]: string;
  };
  header: { style: "stroke" | "box" | "plain"; size: number; strokeWidth?: number; y: number; uppercase?: boolean; weight?: number; tracking?: number };
  list: { show: boolean; x: number; y: number; size: number; rowHeight: number; width: number; uppercase?: boolean };
  badge: { style?: string; size: number; hold: number; box: boolean; y: number };
  caption: { show: boolean; size?: number; bottom?: number };
  transition: string;
  sfx: { transition?: string; reveal?: string; revealFinal?: string };
  music: string; musicVolume: number; progress: boolean; outro: boolean; topShade: number;
  watermark: { opacity: number; size: number };
};

export type MusicTrack = { file: string; label: string; group: string; needsCredit: boolean; artist?: string; duration?: number };

export type Job = {
  status: "queued" | "running" | "done" | "error" | "unknown";
  progress?: number; msg?: string; result?: unknown; type?: string; project?: string; preview?: boolean;
};

export type RenderJob = Job & { id: string };

export type Settings = { groqKey: string; captionStyle: string; cookiesBrowser: string };

export type Meta = {
  source: "groq" | "builtin"; note?: string; titles?: string[]; description?: string; hashtags?: string[]; hook?: string; error?: string;
};
