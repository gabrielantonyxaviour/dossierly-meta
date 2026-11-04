import { Icon } from "@/components/Icon";
import { AgentOrb, ButtonLink } from "@/components/ui";
import { GoogleCalendarLogo } from "@/components/ui/logos";
import { HomeScreen } from "./HomeScreen";
import { Phone } from "./Phone";

/** Hero: the promise and the two ways in, beside the app's Home screen for the sample case. */
export function Hero() {
  return (
    <section className="dl-hero" aria-labelledby="hero-h">
      <div className="dl-wrap dl-hero-grid">
        <div className="dl-hero-copy">
          <p className="dl-kicker"><span className="dl-flag" aria-hidden="true" />For non-EU newcomers with a temporary residence permit in Poland</p>
          <h1 id="hero-h" className="dl-h1">Your own <em>caseworker</em> for life in Poland</h1>
          <p className="dl-lead">
            Dossierly knows your residence case. It explains every official letter, counts each deadline the way Polish
            law does, and speaks Polish for you at the office counter.
          </p>
          <div className="dl-ctas">
            <ButtonLink href="/signup" variant="primary" size="lg" iconEnd="forward">Get started</ButtonLink>
            <ButtonLink href="/signin" variant="secondary" size="lg">Sign in</ButtonLink>
          </div>
          <p className="dl-fine dl-hero-note">
            <Icon name="shield" size={16} />
            It guides you. It never files an application or signs in to MOS for you, and it is not legal advice.
          </p>
        </div>

        <figure className="dl-hero-stage">
          <span className="dl-glow" aria-hidden="true" />
          <Phone label="Dossierly Home screen for the sample case: your next step is to send three documents the office asked for, due Thursday 12 November, 8 days left." tab="home">
            <HomeScreen />
          </Phone>

          <div className="dl-float dl-float--look" aria-hidden="true">
            <span className="dl-float-eyebrow"><Icon name="scan" size={13} /> Look found the deadline</span>
            <span className="dl-float-quote">w terminie 14 dni od dnia doręczenia</span>
            <span className="dl-float-meta">14 days from delivery → <b>Thu 12 Nov</b></span>
          </div>
          <div className="dl-float dl-float--note" aria-hidden="true">
            <AgentOrb size={30} state="still" icon="sparkle" />
            <span>
              <b>Dossierly</b>
              New letter in your Gmail from the Mazowiecki office. The deadline is in your calendar.
            </span>
            <GoogleCalendarLogo size={18} />
          </div>
          <figcaption className="dl-fine dl-hero-cap">Sample case. Arjun Raman and his case are fictional.</figcaption>
        </figure>
      </div>
    </section>
  );
}
