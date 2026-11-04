"use client";

import { useEffect } from "react";

/**
 * Fade-up for [data-reveal] blocks inside `.dl`. Nothing is hidden until this runs, and nothing is armed
 * for people who ask for reduced motion or browsers without IntersectionObserver.
 */
export function Reveal() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".dl");
    if (!root || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    // Anything already on screen shows at once, so the first paint never blinks.
    const fold = window.innerHeight;
    for (const t of targets) if (t.getBoundingClientRect().top < fold) t.classList.add("is-in");
    root.dataset.motion = "on";

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    for (const t of targets) if (!t.classList.contains("is-in")) io.observe(t);

    return () => {
      io.disconnect();
      delete root.dataset.motion;
    };
  }, []);
  return null;
}
