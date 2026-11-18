import Image from "next/image";
import { getT } from "@/lib/i18n/server";

type Moment = { n: string; src: string; wide?: boolean };

/* Text for moment n lives under mo{n}Alt, mo{n}Title, mo{n}Text and mo{n}Tags in the landing messages. */
const MOMENTS: Moment[] = [
  { n: "01", src: "/landing/office-counter.jpg" },
  { n: "02", src: "/landing/letter-hands.jpg" },
  { n: "03", src: "/landing/table-mode.jpg", wide: true },
  { n: "04", src: "/landing/new-home.jpg" },
  { n: "05", src: "/landing/hero-city.jpg" },
];

/** Real-life moments with a full-row table-mode feature. */
export async function Moments() {
  const t = await getT("landing");
  return (
    <section className="lp-sec" aria-labelledby="moments-h">
      <div className="lp-wrap">
        <header className="lp-head-c">
          <h2 id="moments-h" className="lp-h2" data-sweep>{t("momentsTitle")}</h2>
          <p className="lp-body">{t("momentsBody")}</p>
        </header>
        <div className="lp-moments">
          {MOMENTS.map((m) => (
            <div key={m.n} className={`lp-moment${m.wide ? " lp-moment-wide" : ""}`} data-reveal>
              <div className="lp-moment-frame">
                <div className="lp-moment-img">
                  <Image src={m.src} alt={t(`mo${m.n}Alt`)} fill sizes={m.wide
                    ? "(max-width: 767px) calc(100vw - 48px), (max-width: 1023px) calc((100vw - 112px) * 0.575), (max-width: 1199px) calc((100vw - 160px) * 0.575), (max-width: 1399px) calc((100vw - 176px) * 0.575), 703px"
                    : "(max-width: 767px) calc(100vw - 48px), (max-width: 1023px) calc((100vw - 112px) / 2), (max-width: 1199px) calc((100vw - 160px) / 2), (max-width: 1399px) calc((100vw - 208px) / 4), 298px"} />
                </div>
              </div>
              <div className="lp-moment-text">
                <span className="lp-moment-n">{m.n}</span>
                <div>
                  <h3>{t(`mo${m.n}Title`)}</h3>
                  <p>{t(`mo${m.n}Text`)}</p>
                  <p className="lp-moment-tags">{t(`mo${m.n}Tags`)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
