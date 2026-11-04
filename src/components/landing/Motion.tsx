"use client";

import { useEffect } from "react";

/**
 * Landing motion: fade-ups for [data-reveal], the colour sweep on [data-sweep] titles, and the
 * how-it-works scroll spy (active step, its visual and its tab). Nothing is hidden until this
 * runs, and nothing moves for people who ask for reduced motion (the scroll spy still works).
 */
export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".lp");
    if (!root || typeof IntersectionObserver === "undefined") return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let io: IntersectionObserver | undefined;
    if (!reduce) {
      root.dataset.motion = "on";
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            e.target.classList.add("is-in");
            io?.unobserve(e.target);
          }
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
      );
      root.querySelectorAll<HTMLElement>("[data-reveal], [data-sweep]").forEach((t) => io?.observe(t));
    }

    const steps = Array.from(root.querySelectorAll<HTMLElement>("[data-step]"));
    const visuals = Array.from(root.querySelectorAll<HTMLElement>("[data-visual]"));
    const tabs = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-step-link]"));
    let current = "";
    const setActive = (id: string) => {
      if (id === current) return;
      current = id;
      for (const s of steps) s.classList.toggle("is-active", s.dataset.step === id);
      for (const v of visuals) v.classList.toggle("is-active", v.dataset.visual === id);
      for (const t of tabs) {
        const on = t.dataset.stepLink === id;
        t.classList.toggle("is-active", on);
        if (on) t.setAttribute("aria-current", "step");
        else t.removeAttribute("aria-current");
      }
    };
    // The active step is the last one whose top has passed 55% of the viewport; the first by default.
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.55;
      let id = steps[0]?.dataset.step ?? "";
      for (const s of steps) if (s.getBoundingClientRect().top < line) id = s.dataset.step ?? id;
      setActive(id);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();

    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
      delete root.dataset.motion;
    };
  }, []);
  return null;
}
