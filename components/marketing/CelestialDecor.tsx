import type { CSSProperties } from "react";

type StarStyle = CSSProperties & {
  "--star-low": number;
  "--star-high": number;
  "--star-glow": string;
};

type StarRegion = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function seededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createStars(count: number, seed: number, region: StarRegion): StarStyle[] {
  const random = seededRandom(seed);

  return Array.from({ length: count }, () => {
    const sizeRoll = random();
    const size = sizeRoll > 0.96 ? 3 : sizeRoll > 0.78 ? 2 : 1;
    const highOpacity = 0.56 + random() * 0.4;

    return {
      left: `${(region.left + random() * region.width).toFixed(2)}%`,
      top: `${(region.top + random() * region.height).toFixed(2)}%`,
      width: `${size}px`,
      height: `${size}px`,
      animationDelay: `-${(random() * 7).toFixed(2)}s`,
      animationDuration: `${(3.8 + random() * 3.8).toFixed(2)}s`,
      "--star-low": Number((highOpacity * 0.38).toFixed(2)),
      "--star-high": Number(highOpacity.toFixed(2)),
      "--star-glow": `${size * 3 + 2}px`,
    };
  });
}

const STARS = createStars(72, 0xc7a5b92d, { left: 0, top: 0, width: 100, height: 100 });
const TOP_RIGHT_STARS = createStars(12, 0x38e1f647, {
  left: 68,
  top: 7,
  width: 30,
  height: 34,
});

/**
 * A fixed, decorative night sky for the marketing page. Star positions are
 * deterministic so the server output is stable; only their brightness changes.
 */
export function CelestialDecor() {
  return (
    <div aria-hidden="true" className="marketing-sky pointer-events-none fixed inset-0 overflow-hidden">
      <div className="marketing-nebula marketing-nebula--violet" />
      <div className="marketing-nebula marketing-nebula--blue" />
      <div className="marketing-nebula marketing-nebula--horizon" />

      <div className="absolute inset-0">
        {STARS.map((style, index) => {
          return <span key={index} className="marketing-star" style={style} />;
        })}

        {TOP_RIGHT_STARS.map((style, index) => {
          return <span key={`top-right-${index}`} className="marketing-star" style={style} />;
        })}
      </div>
    </div>
  );
}
