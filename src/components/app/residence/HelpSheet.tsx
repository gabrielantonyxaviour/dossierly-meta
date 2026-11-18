"use client";
import { BottomSheet, Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { LEGAL_HELP } from "@/lib/residence/model";
import { useT } from "@/lib/i18n/client";
import { Fact } from "@/components/residence/parts";

/** Free legal aid and a lawyer directory, each opening the organisation's own site. */
export function HelpList() {
  const t = useT("residence");
  return (
    <div className="rp-stack">
      {LEGAL_HELP.map((h) => (
        <a key={h.id} href={h.url} target="_blank" rel="noopener noreferrer" className="rs-help-link">
          <Fact icon="scale" title={h.name} sub={t(`help_${h.id}`)} end={<Icon name="external" size={16} />} />
        </a>
      ))}
    </div>
  );
}

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT("residence");
  return (
    <BottomSheet open={open} onClose={onClose} title={t("helpTitle")}>
      <div className="rp-stack">
        <p className="rp-lead">{t("helpLead")}</p>
        <HelpList />
        <p className="rp-note">{t("helpNote")}</p>
        <Button variant="ghost" onClick={onClose}>{t("close")}</Button>
      </div>
    </BottomSheet>
  );
}
