import { ButtonItem, ConfirmModal, DropdownItem, PanelSectionRow, showModal } from "@decky/ui";
import { useState } from "react";
import { healthCheck } from "../api";
import { PRESET_LABELS, PRESET_ORDER, RESTART } from "../logic";
import { RemoveData } from "./RemoveData";

interface Props {
  defaultPreset: string;
  onDefaultPreset: (preset: string) => void;
  onShowLog: () => void;
  onReset: () => void;
  onRemoved: () => void;
}

function HealthModal({ ok, summary, details, closeModal }: { ok: boolean; summary: string; details: string; closeModal?: () => void }) {
  return (
    <ConfirmModal strTitle="Health check" strOKButtonText="Close" bAlertDialog closeModal={closeModal}>
      <p>{ok ? "✓ " : "✗ "}{summary}</p>
      {details && (
        <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 300, overflow: "auto" }}>
          {details}
        </pre>
      )}
    </ConfirmModal>
  );
}

export function MoreSection({ defaultPreset, onDefaultPreset, onShowLog, onReset, onRemoved }: Props) {
  const [checking, setChecking] = useState(false);
  return (
    <>
      <PanelSectionRow>
        <DropdownItem
          label="Default preset for new games"
          description={RESTART.none}
          rgOptions={PRESET_ORDER.map((key) => ({ data: key, label: PRESET_LABELS[key] }))}
          selectedOption={defaultPreset}
          onChange={(o) => onDefaultPreset(o.data as string)}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          disabled={checking}
          description={RESTART.none}
          onClick={async () => {
            setChecking(true);
            try {
              const r = await healthCheck();
              showModal(<HealthModal {...r} />);
            } finally {
              setChecking(false);
            }
          }}
        >
          {checking ? "Checking..." : "Health check"}
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" description={RESTART.none} onClick={onShowLog}>
          Show log
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          description={`Removes HaqGen's game profiles only. ${RESTART.game}`}
          onClick={onReset}
        >
          Reset profiles
        </ButtonItem>
      </PanelSectionRow>
      <RemoveData onDone={onRemoved} />
    </>
  );
}
