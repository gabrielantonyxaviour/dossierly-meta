import Link from "next/link";
import { HeaderActions } from "./HeaderActions";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap site-bar">
        <Link href="/" aria-label="Dossierly home" className="logo-link"><Logo /></Link>
        <nav aria-label="Main" className="site-nav">
          <Link href="/#how">How it works</Link>
          <Link href="/#deadlines">Deadlines</Link>
          <Link href="/#meta">Built on Meta</Link>
        </nav>
        <HeaderActions />
      </div>
    </header>
  );
}
