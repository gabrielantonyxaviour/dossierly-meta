import { Icon } from "@/components/Icon";
import { AgentOrb, Pill } from "@/components/ui";

/** The sample summons (wezwanie), drawn as paper. Outlined spans mark what Look found on the photo. */
function Paper() {
  return (
    <div className="dl-paper">
      <p className="dl-paper-r">Warszawa, dnia 22.10.2026 r.</p>
      <p className="dl-paper-b">MAZOWIECKI URZĄD WOJEWÓDZKI W WARSZAWIE</p>
      <p>Wydział Spraw Cudzoziemców</p>
      <p className="dl-paper-r">
        <span className="dl-sam" data-tag="Case number">Znak sprawy: <b>WSC-II-P.6151.48213.2026</b></span>
      </p>
      <p>Pan Arjun Raman<br />ul. Złota 44 m. 12, 00-120 Warszawa</p>
      <p className="dl-paper-c dl-paper-b">WEZWANIE</p>
      <p className="dl-paper-c">do uzupełnienia braków formalnych wniosku</p>
      <p>
        Na podstawie art. 64 § 2 Kodeksu postępowania administracyjnego wzywam Pana do uzupełnienia braków
        formalnych wniosku o udzielenie zezwolenia na pobyt czasowy, złożonego w dniu 18.09.2026 r., poprzez:
      </p>
      <ol className="dl-sam dl-sam--block" data-tag="3 documents">
        <li>1. przedłożenie aktualnej umowy najmu lub innego dokumentu potwierdzającego adres,</li>
        <li>2. przedłożenie potwierdzenia ubezpieczenia zdrowotnego na cały okres pobytu,</li>
        <li>3. przedłożenie pełnej kopii paszportu.</li>
      </ol>
      <p>
        <span className="dl-sam dl-sam--due" data-tag="Deadline"><b>w terminie 14 dni od dnia doręczenia</b></span>{" "}
        niniejszego wezwania, pod rygorem pozostawienia wniosku bez rozpoznania.
      </p>
      <p className="dl-paper-foot">SAMPLE document. Fictional person and case number.</p>
    </div>
  );
}

/** Look: a phone photo of the letter with outlines, and the plain-language explanation underneath. */
export function LookScreen() {
  return (
    <div className="dl-scr dl-look">
      <div className="dl-look-bar">
        <Icon name="close" size={16} />
        <b>Look</b>
        <Pill tone="outline">Sample</Pill>
      </div>
      <div className="dl-look-photo">
        <Paper />
      </div>
      <div className="dl-sheet">
        <span className="dl-grab" />
        <div className="dl-sheet-h">
          <AgentOrb size={22} state="still" />
          <b>Summons to complete your application</b>
        </div>
        <p>The office needs 3 documents within 14 days of delivery. If they don’t arrive, the application is left unexamined.</p>
        <ul className="dl-docs">
          <li className="is-ok"><Icon name="check" size={13} /> Full passport copy <small>In your documents</small></li>
          <li><Icon name="alert" size={13} /> Rental agreement <small>Missing</small></li>
          <li><Icon name="alert" size={13} /> Health insurance, whole stay <small>Missing</small></li>
        </ul>
      </div>
    </div>
  );
}
