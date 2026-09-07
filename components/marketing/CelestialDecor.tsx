import type { CSSProperties } from "react";

const STAR_COUNT = 72;

type StarStyle = CSSProperties & {
  "--star-low": number;
  "--star-high": number;
  "--star-glow": string;
};

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
        {Array.from({ length: STAR_COUNT }, (_, index) => {
          const size = index % 17 === 0 ? 3 : index % 5 === 0 ? 2 : 1;
          const highOpacity = 0.58 + ((index * 13) % 38) / 100;
          const style: StarStyle = {
            left: `${(index * 47 + index * index * 3 + 11) % 101}%`,
            top: `${(index * 29 + index * index * 7 + 5) % 101}%`,
            width: `${size}px`,
            height: `${size}px`,
            animationDelay: `${-((index * 0.73) % 6.5)}s`,
            animationDuration: `${3.8 + ((index * 11) % 36) / 10}s`,
            "--star-low": Number((highOpacity * 0.38).toFixed(2)),
            "--star-high": Number(highOpacity.toFixed(2)),
            "--star-glow": `${size * 3 + 2}px`,
          };

          return <span key={index} className="marketing-star" style={style} />;
        })}
      </div>
    </div>
  );
}
