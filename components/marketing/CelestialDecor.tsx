/**
 * Faint, decorative celestial motif for the hero — one dashed orbital arc,
 * a soft radial glow, and a couple of star-like points. Purely decorative:
 * hidden from the accessibility tree and, when animated, respects
 * prefers-reduced-motion (see the `.orbit-arc` rule in globals.css).
 */
export function CelestialDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-[hsl(var(--primary)/0.10)] blur-[110px]" />
      <svg
        className="orbit-arc absolute left-1/2 top-[-160px] h-[520px] w-[520px] -translate-x-1/2 opacity-40 sm:h-[680px] sm:w-[680px]"
        viewBox="0 0 680 680"
        fill="none"
      >
        <circle
          cx="340"
          cy="340"
          r="280"
          stroke="hsl(var(--primary) / 0.3)"
          strokeWidth="1"
          strokeDasharray="2 12"
        />
      </svg>
      <span className="absolute left-[16%] top-[20%] h-1 w-1 rounded-full bg-[hsl(var(--foreground)/0.45)]" />
      <span className="absolute right-[22%] top-[10%] h-[3px] w-[3px] rounded-full bg-[hsl(var(--foreground)/0.55)]" />
      <span className="absolute right-[10%] top-[34%] h-1 w-1 rounded-full bg-[hsl(var(--foreground)/0.35)]" />
    </div>
  );
}
