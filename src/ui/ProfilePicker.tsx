import { ButtonItem, Field, PanelSectionRow } from "@decky/ui";
import { useState } from "react";
import { FaCheck, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { ProfileEntry } from "../api";
import { S } from "../strings";

interface Props {
  profiles: ProfileEntry[];
  selected: number | null;
  locked: string | null;
  onSelect: (entry: ProfileEntry) => void;
}

export function ProfilePicker({ profiles, selected, locked, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  if (locked) {
    return (
      <PanelSectionRow>
        <Field label={S.profile} description={S.profileFollowsGame} bottomSeparator="none">
          {locked}
        </Field>
      </PanelSectionRow>
    );
  }
  const current = profiles.find((p) => p.app_id === selected) ?? profiles[0];
  return (
    <>
      <PanelSectionRow>
        <ButtonItem layout="below" label={S.profile} bottomSeparator={open ? "none" : "standard"} onClick={() => setOpen((v) => !v)}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current?.label ?? "Default"}</span>
            {open ? <FaChevronUp aria-hidden /> : <FaChevronDown aria-hidden />}
          </span>
        </ButtonItem>
      </PanelSectionRow>
      {open &&
        profiles.map((p) => (
          <PanelSectionRow key={p.app_id ?? "default"}>
            <Field
              label={p.label}
              icon={p.app_id === (current?.app_id ?? null) ? <FaCheck aria-hidden /> : undefined}
              focusable
              highlightOnFocus
              bottomSeparator="none"
              onActivate={() => {
                onSelect(p);
                setOpen(false);
              }}
            />
          </PanelSectionRow>
        ))}
    </>
  );
}
