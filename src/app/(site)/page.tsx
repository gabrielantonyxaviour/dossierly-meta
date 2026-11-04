import { BuiltOn } from "@/components/landing/BuiltOn";
import { Compare } from "@/components/landing/Compare";
import { Countries } from "@/components/landing/Countries";
import { Faq, FinalCta } from "@/components/landing/Closing";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Moments } from "@/components/landing/Moments";
import { LandingMotion } from "@/components/landing/Motion";
import { PhoneSection } from "@/components/landing/PhoneSection";
import { Privacy } from "@/components/landing/Privacy";
import { Problem } from "@/components/landing/Problem";
import "@/components/landing/landing-sections.css";
import "@/components/landing/landing-mocks.css";

export default function Landing() {
  return (
    <div className="lp">
      <Hero />
      <Problem />
      <HowItWorks />
      <Moments />
      <PhoneSection />
      <Privacy />
      <BuiltOn />
      <Compare />
      <Countries />
      <FinalCta />
      <Faq />
      <LandingMotion />
    </div>
  );
}
