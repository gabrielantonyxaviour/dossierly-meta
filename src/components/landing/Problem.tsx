const JOBS = [
  { t: "Getting ready for the office", s: "Which documents, which rules, what to bring" },
  { t: "Understanding the counter", s: "A conversation in Polish that decides your case" },
  { t: "Answering letters on time", s: "A wezwanie gives you 14 days from delivery" },
];

/** The problem: three jobs a newcomer carries, one stat for how long they carry them. */
export function Problem() {
  return (
    <section className="lp-sec lp-sec-lg" aria-labelledby="problem-h">
      <div className="lp-wrap lp-problem">
        <div className="lp-problem-copy">
          <p className="lp-eyebrow">The problem</p>
          <h2 id="problem-h" className="lp-h2" data-sweep>Three jobs stand between you and your new life.</h2>
          <p className="lp-body">
            A residence-and-work permit in Poland means a case that runs for more than a year, talks at the counter in
            Polish, and letters with deadlines counted from the day they arrive. Miss one and the application is left
            unexamined. Dossierly carries all three.
          </p>
        </div>
        <ol className="lp-jobs">
          {JOBS.map((j, i) => (
            <li key={j.t} className="lp-job" data-reveal>
              <span className="lp-job-n">{i + 1}</span>
              <div className="lp-job-t">
                <h3>{j.t}</h3>
                <p>{j.s}</p>
              </div>
              <span className="lp-tag">Handled by Dossierly</span>
            </li>
          ))}
          <li className="lp-job lp-job-you" data-reveal>
            <span className="lp-job-n">4</span>
            <div className="lp-job-t">
              <h3>Building your life here</h3>
              <p>The work, the flat, the people you came for</p>
            </div>
            <span className="lp-tag lp-tag-dark">Yours again</span>
          </li>
        </ol>
      </div>
    </section>
  );
}
