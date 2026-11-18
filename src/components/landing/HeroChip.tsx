"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { useT } from "@/lib/i18n/client";

const JOBS: { icon: IconName; key: string }[] = [
  { icon: "prepare", key: "chipPrepares" },
  { icon: "meet", key: "chipInterprets" },
  { icon: "letter", key: "chipReads" },
  { icon: "calendar", key: "chipCounts" },
];

/** The small rotating chip above the headline. Holds still for reduced motion. */
export function HeroChip() {
  const t = useT("landing");
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % JOBS.length), 2600);
    return () => window.clearInterval(id);
  }, []);
  const job = JOBS[i];
  return (
    <p className="lp-hero-chip" aria-label={t("chipAria")}>
      <span key={job.key} className="lp-hero-chip-in" aria-hidden="true">
        <Icon name={job.icon} size={13} />
        {t(job.key)}
      </span>
    </p>
  );
}
