import { Field, PanelSectionRow } from "@decky/ui";
import { useState } from "react";
import { FaPlus } from "react-icons/fa";
import { S } from "../strings";
import { Hint, PlainButton } from "./theme";

export function CreateProfile({
  games,
  onCreate,
}: {
  games: { app_id: number; name: string }[];
  onCreate: (game: { app_id: number; name: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PlainButton disabled={busy} onClick={() => setOpen((v) => !v)}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <FaPlus size={12} aria-hidden /> {S.createProfile}
        </span>
      </PlainButton>
      {open && (
        <>
          <Hint>{games.length ? S.createProfileHint : S.noGamesToCreate}</Hint>
          {games.map((g) => (
            <PanelSectionRow key={g.app_id}>
              <Field
                label={g.name}
                focusable
                highlightOnFocus
                bottomSeparator="none"
                onActivate={async () => {
                  setBusy(true);
                  try {
                    await onCreate(g);
                    setOpen(false);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </PanelSectionRow>
          ))}
        </>
      )}
    </>
  );
}
