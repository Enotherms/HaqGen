import { ButtonItem, PanelSection, PanelSectionRow } from "@decky/ui";
import { useState } from "react";
import { State } from "../api";
import { RESTART } from "../logic";

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <PanelSectionRow>
      <div style={{ display: "flex", gap: 8, fontSize: 13 }}>
        <span>{ok ? "✓" : "✗"}</span>
        <span>{text}</span>
      </div>
    </PanelSectionRow>
  );
}

export function SetupCard({ state, onSetup }: { state: State; onSetup: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <PanelSection title="Set up HaqGen">
      <Check
        ok={state.dll_found}
        text={state.dll_found ? "Lossless Scaling found" : "Lossless Scaling not found (install it from Steam)"}
      />
      <Check ok={state.installed} text={state.installed ? "lsfg-vk installed" : "lsfg-vk not installed"} />
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          disabled={busy || !state.dll_found}
          description={RESTART.setup}
          onClick={async () => {
            setBusy(true);
            try {
              await onSetup();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Setting up..." : "Set up"}
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}
