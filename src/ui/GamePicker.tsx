import { ButtonItem, Field, PanelSectionRow } from "@decky/ui";
import { useState } from "react";
import { FaCheck, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { GameOption, pickerRows, pickerValue } from "../logic";
import { S } from "../strings";

interface Props {
  options: GameOption[];
  selectedId: number | null;
  selectedName: string | null;
  countLabel: string;
  onSelect: (appId: number) => void;
}

export function GamePicker({ options, selectedId, selectedName, countLabel, onSelect }: Props) {
  const [open, setOpen] = useState(selectedId === null);
  return (
    <>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          label={S.game}
          description={countLabel}
          bottomSeparator={open ? "none" : "standard"}
          onClick={() => setOpen((v) => !v)}
        >
          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {pickerValue(selectedName)}
            </span>
            {open ? <FaChevronUp aria-hidden /> : <FaChevronDown aria-hidden />}
          </span>
        </ButtonItem>
      </PanelSectionRow>
      {open &&
        pickerRows(options, selectedId).map((row) => (
          <PanelSectionRow key={row.data}>
            <Field
              label={row.label}
              icon={row.selected ? <FaCheck aria-hidden /> : undefined}
              focusable
              highlightOnFocus
              bottomSeparator="none"
              onActivate={() => {
                onSelect(row.data);
                setOpen(false);
              }}
            />
          </PanelSectionRow>
        ))}
    </>
  );
}
