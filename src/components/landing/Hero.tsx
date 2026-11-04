import Link from "next/link";
import { HeroChip } from "./HeroChip";
import { HeroMock } from "./HeroMock";

const CX = 720;
const CY = 716;
const R = 700;
/** Radial ticks inside the arc, from far left to far right. */
const TICKS = [-90, -72, -56, -42, -28, -14, 0, 14, 28, 42, 56, 72, 90].map((deg) => {
  const a = (deg * Math.PI) / 180;
  const r1 = deg === 0 ? 532 : 540;
  const r2 = 580;
  const p = (r: number) => [CX + r * Math.sin(a), CY - r * Math.cos(a)].map((n) => Math.round(n * 10) / 10);
  const [x1, y1] = p(r1);
  const [x2, y2] = p(r2);
  return { deg, x1, y1, x2, y2 };
});

/** The dotted dial behind the hero: a slow sweep of coloured dots travels along it. */
function Dial() {
  return (
    <svg className="lp-dial" viewBox="0 0 1440 720" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="lp-dial-g" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#498fff" stopOpacity="0" />
          <stop offset="0.45" stopColor="#498fff" />
          <stop offset="0.75" stopColor="#ff7a7a" />
          <stop offset="1" stopColor="#ffbc74" />
        </linearGradient>
      </defs>
      <circle className="lp-dial-dots" cx={CX} cy={CY} r={R} />
      {TICKS.map((t) => (
        <line key={t.deg} className={`lp-dial-tick${t.deg === 0 ? " is-top" : ""}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
      ))}
      <line className="lp-dial-base" x1="100" y1={CY} x2="140" y2={CY} />
      <line className="lp-dial-base" x1="1300" y1={CY} x2="1340" y2={CY} />
      <g className="lp-dial-sweep">
        <path d={`M ${CX - R * Math.sin(0.2)} ${CY - R * Math.cos(0.2)} A ${R} ${R} 0 0 1 ${CX} ${CY - R}`} className="lp-dial-trail" stroke="url(#lp-dial-g)" />
        <circle cx={CX} cy={CY - R} r="4" className="lp-dial-head" />
      </g>
    </svg>
  );
}

/** Hero: centred promise, the two ways in, then one large view of Arjun's case. */
export function Hero() {
  return (
    <section className="lp-hero" aria-labelledby="hero-h">
      <Dial />
      <div className="lp-wrap lp-hero-in">
        <HeroChip />
        <h1 id="hero-h" className="lp-hero-title">A caseworker for your life abroad</h1>
        <p className="lp-hero-sub">
          Your own private AI agent remembers your whole residence case. It prepares you for the office, interprets at
          the counter, reads the letters that follow and counts every deadline.
        </p>
        <div className="lp-hero-ctas">
          <Link className="lp-btn lp-btn-dark" href="/signup">Get started free</Link>
          <Link className="lp-btn lp-btn-soft" href="/signup?start=sample">See the sample case</Link>
        </div>
        <p className="lp-hero-link">
          <Link href="/countries" className="lp-ulink">Which offices are covered?</Link>
        </p>
      </div>
      <div className="lp-wrap lp-hero-stage">
        <HeroMock />
        <p className="lp-hero-proof">Poland first · the Mazowiecki office in Warsaw · interprets and explains, never legal advice</p>
      </div>
    </section>
  );
}
