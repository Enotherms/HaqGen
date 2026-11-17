import { ButtonItem, PanelSectionRow } from "@decky/ui";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

export function Collapse({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <PanelSectionRow>
      <ButtonItem layout="inline" label={label} bottomSeparator="none" onClick={onToggle}>
        {open ? <FaChevronUp aria-label="Collapse" /> : <FaChevronDown aria-label="Expand" />}
      </ButtonItem>
    </PanelSectionRow>
  );
}
