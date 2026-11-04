import Link from "next/link";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="stack" style={{ ["--gap" as string]: "10px" }}>
          <Logo size={24} />
          <p className="small muted" style={{ maxWidth: 380 }}>
            You are using an AI system. Dossierly interprets and explains; it does not give legal or medical advice.
          </p>
          <p className="tiny muted">Operated by Gabriel Antony Xaviour (individual) · <a href="mailto:contact@cosmiclan.com">contact@cosmiclan.com</a></p>
        </div>
        <nav aria-label="Footer" className="footer-links">
          <Link href="/pricing">Pricing</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/limits">Limits</Link>
          <Link href="/countries">Countries</Link>
        </nav>
      </div>
    </footer>
  );
}
