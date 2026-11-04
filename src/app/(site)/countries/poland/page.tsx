import type { Metadata } from "next";
import Link from "next/link";
import { PL_STATS } from "@/components/site/Coverage";
import { PolandCoverage } from "@/components/site/PolandCoverage";

export const metadata: Metadata = { title: "Poland coverage", description: "Offices, letter types with deadline rules, fees and the official sources Dossierly reads." };

export default function PolandPage() {
  return (
    <div className="doc-page" style={{ maxWidth: 960 }}>
      <Link href="/countries" className="small">← All countries</Link>
      <span className="kicker" style={{ marginTop: 20 }}>Supported · since October 2026</span>
      <h1>Poland</h1>
      <p className="lead muted">Temporary residence and work permits (zezwolenie na pobyt czasowy i pracę) at the Mazowiecki office in Warsaw: applications through MOS, fingerprints, letters by e-Doręczenia, decisions and card collection.</p>
      <dl className="stat-row" style={{ margin: "20px 0 36px", maxWidth: 560 }}>
        <div><dt>Offices</dt><dd className="mono">{PL_STATS.offices}</dd></div>
        <div><dt>Letter types</dt><dd className="mono">{PL_STATS.letterTypes}</dd></div>
        <div><dt>Sources</dt><dd className="mono">{PL_STATS.sources}</dd></div>
        <div><dt>Languages</dt><dd className="mono">{PL_STATS.languages}</dd></div>
      </dl>
      <PolandCoverage />
    </div>
  );
}
