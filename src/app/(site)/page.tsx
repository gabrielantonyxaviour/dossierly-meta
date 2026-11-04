import { BuiltOn } from "@/components/landing/BuiltOn";
import { CaseAgent } from "@/components/landing/CaseAgent";
import { Faq, FinalCta } from "@/components/landing/Closing";
import { Deadline } from "@/components/landing/Deadline";
import { Hero } from "@/components/landing/Hero";
import { Limits } from "@/components/landing/Limits";
import { Moments } from "@/components/landing/Moments";
import { Reveal } from "@/components/landing/Reveal";
import { Toolkit } from "@/components/landing/Toolkit";
import "@/components/landing/base.css";
import "@/components/landing/mocks.css";
import "@/components/landing/sections.css";
import "@/components/landing/sections-2.css";

export default function Landing() {
  return (
    <div className="dl">
      <Hero />
      <Moments />
      <Deadline />
      <CaseAgent />
      <Toolkit />
      <Limits />
      <BuiltOn />
      <Faq />
      <FinalCta />
      <Reveal />
    </div>
  );
}
