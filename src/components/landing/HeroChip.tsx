"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";

const JOBS: { icon: IconName; text: string }[] = [
  { icon: "prepare", text: "Prepares you for the office" },
  { icon: "meet", text: "Interprets at the counter" },
  { icon: "letter", text: "Reads the letters" },
  { icon: "calendar", text: "Counts the deadlines" },
];

/** The small rotating chip above the headline. Holds still for reduced motion. */
export function HeroChip() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % JOBS.length), 2600);
    return () => window.clearInterval(id);
  }, []);
  const job = JOBS[i];
  return (
    <p className="lp-hero-chip" aria-label="What your agent does: prepares, interprets, reads letters, counts deadlines">
      <span key={job.text} className="lp-hero-chip-in" aria-hidden="true">
        <Icon name={job.icon} size={13} />
        {job.text}
      </span>
    </p>
  );
}
