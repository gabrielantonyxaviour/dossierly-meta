import { getT } from "@/lib/i18n/server";

/** The problem: three jobs a newcomer carries, one stat for how long they carry them. */
export async function Problem() {
  const t = await getT("landing");
  const jobs = [
    { t: t("job1"), s: t("job1s") },
    { t: t("job2"), s: t("job2s") },
    { t: t("job3"), s: t("job3s") },
  ];
  return (
    <section className="lp-sec lp-sec-lg" aria-labelledby="problem-h">
      <div className="lp-wrap lp-problem">
        <div className="lp-problem-copy">
          <p className="lp-eyebrow">{t("problemEyebrow")}</p>
          <h2 id="problem-h" className="lp-h2" data-sweep>{t("problemTitle")}</h2>
          <p className="lp-body">{t("problemBody")}</p>
        </div>
        <ol className="lp-jobs">
          {jobs.map((j, i) => (
            <li key={j.t} className="lp-job" data-reveal>
              <span className="lp-job-n">{i + 1}</span>
              <div className="lp-job-t">
                <h3>{j.t}</h3>
                <p>{j.s}</p>
              </div>
              <span className="lp-tag">{t("jobHandled")}</span>
            </li>
          ))}
          <li className="lp-job lp-job-you" data-reveal>
            <span className="lp-job-n">4</span>
            <div className="lp-job-t">
              <h3>{t("job4")}</h3>
              <p>{t("job4s")}</p>
            </div>
            <span className="lp-tag lp-tag-dark">{t("jobYours")}</span>
          </li>
        </ol>
      </div>
    </section>
  );
}
