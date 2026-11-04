import { Icon, type IconName } from "@/components/Icon";

const PARTS: { icon: IconName; name: string; desc: string }[] = [
  { icon: "speak", name: "Muse Spark", desc: "Interpreted turns, your agent, and the interpret-only guard" },
  { icon: "camera", name: "SAM 3.1", desc: "Reads the letters you photograph" },
  { icon: "link", name: "Muse Spark", desc: "Links each new letter to the whole case" },
  { icon: "prepare", name: "Muse Voice Transcribe", desc: "Turns the official's speech into text" },
  { icon: "lock", name: "Cloudflare", desc: "App hosting in the EU" },
];

/** "And it's all one system": every part, what it does in the product. */
export function BuiltOn() {
  return (
    <section className="lp-sec" aria-labelledby="built-h">
      <div className="lp-wrap">
        <header className="lp-head-l">
          <h2 id="built-h" className="lp-h2" data-sweep>And it&apos;s all one system</h2>
          <p className="lp-body">
            Meta Muse models, each in the job it fits, inside one private agent per person. No stitched-together apps.
          </p>
        </header>
        <ul className="lp-parts">
          {PARTS.map((p) => (
            <li key={`${p.name}-${p.desc}`}>
              <Icon name={p.icon} size={18} />
              <div><b>{p.name}</b><span>{p.desc}</span></div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
