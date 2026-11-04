import Image from "next/image";

type Moment = { n: string; src: string; alt: string; title: string; text: string; tags: string; wide?: boolean };

const MOMENTS: Moment[] = [
  {
    n: "01", src: "/landing/office-counter.jpg", alt: "A man at a government office counter, talking with the official behind it",
    title: "At the office counter", text: "Interprets both ways and speaks up when a date, amount or document could be misunderstood.",
    tags: "Fingerprints • Submissions • Questions",
  },
  {
    n: "02", src: "/landing/letter-hands.jpg", alt: "Hands unfolding an official letter at a wooden table",
    title: "When a letter arrives", text: "Photograph it or upload the e-Doręczenia PDF. The Polish stays beside the explanation.",
    tags: "Wezwanie • Decisions • e-Doręczenia",
  },
  {
    n: "03", src: "/landing/table-mode.jpg", alt: "A phone lying flat on a counter between an applicant and an official",
    title: "Phone flat on the table", text: "Table mode turns the official's half of the screen to face them, and yours to face you.",
    tags: "English • Ukrainian • Hindi • Tamil", wide: true,
  },
  {
    n: "04", src: "/landing/new-home.jpg", alt: "A woman in her new, half-unpacked flat, phone in hand",
    title: "Settling in", text: "Wrap-ups file what was agreed and every date named into your calendar and your case.",
    tags: "Calendar • Case memory",
  },
  {
    n: "05", src: "/landing/hero-city.jpg", alt: "A Warsaw street with tram tracks in the morning light",
    title: "Before the next visit", text: "Prepare reads today's official pages, and cites each paragraph.",
    tags: "Official pages • Citations",
  },
];

/** Real-life moments with a full-row table-mode feature. */
export function Moments() {
  return (
    <section className="lp-sec" aria-labelledby="moments-h">
      <div className="lp-wrap">
        <header className="lp-head-c">
          <h2 id="moments-h" className="lp-h2" data-sweep>Made for the moments that decide a case</h2>
          <p className="lp-body">
            Newcomers are not paperwork experts. Dossierly learns your case, then shows up at the counter, at the
            kitchen table and before every visit.
          </p>
        </header>
        <div className="lp-moments">
          {MOMENTS.map((m) => (
            <div key={m.n} className={`lp-moment${m.wide ? " lp-moment-wide" : ""}`} data-reveal>
              <div className="lp-moment-frame">
                <div className="lp-moment-img">
                  <Image src={m.src} alt={m.alt} fill sizes={m.wide
                    ? "(max-width: 767px) calc(100vw - 48px), (max-width: 1023px) calc((100vw - 112px) * 0.575), (max-width: 1199px) calc((100vw - 160px) * 0.575), (max-width: 1399px) calc((100vw - 176px) * 0.575), 703px"
                    : "(max-width: 767px) calc(100vw - 48px), (max-width: 1023px) calc((100vw - 112px) / 2), (max-width: 1199px) calc((100vw - 160px) / 2), (max-width: 1399px) calc((100vw - 208px) / 4), 298px"} />
                </div>
              </div>
              <div className="lp-moment-text">
                <span className="lp-moment-n">{m.n}</span>
                <div>
                  <h3>{m.title}</h3>
                  <p>{m.text}</p>
                  <p className="lp-moment-tags">{m.tags}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
