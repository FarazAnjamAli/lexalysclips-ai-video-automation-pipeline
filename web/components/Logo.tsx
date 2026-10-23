/** LexalysClips mark: two rising rank bars + a play arrow, in the electric-lime accent. */
export function LogoMark({ size = 24, glow = true, className = "" }: { size?: number; glow?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}
      style={glow ? { filter: "drop-shadow(0 0 6px rgba(198,244,50,.55)) drop-shadow(0 0 14px rgba(198,244,50,.25))" } : undefined}>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <rect x="5.5" y="17" width="4" height="8" rx="1.2" fill="var(--accent-ink)" />
      <rect x="11" y="12.5" width="4" height="12.5" rx="1.2" fill="var(--accent-ink)" />
      <path d="M17.5 7.8c0-.95 1.03-1.54 1.85-1.06l8.6 8.9c.75.5.75 1.6 0 2.1l-8.6 8.4c-.82.48-1.85-.11-1.85-1.06Z" fill="var(--accent-ink)" />
    </svg>
  );
}
