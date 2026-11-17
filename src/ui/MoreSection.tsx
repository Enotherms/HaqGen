import { ButtonItem, ConfirmModal, DropdownItem, PanelSectionRow, showModal } from "@decky/ui";
import { useState } from "react";
import { healthCheck } from "../api";
import { PRESET_LABELS, PRESET_ORDER, RESTART } from "../logic";
import { S } from "../strings";
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
    <ConfirmModal strTitle={S.healthCheck} strOKButtonText={S.close} bAlertDialog closeModal={closeModal}>
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
          label={S.defaultPreset}
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
          {checking ? S.checking : S.healthCheck}
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" description={RESTART.none} onClick={onShowLog}>
          {S.showLog}
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          description={`${S.resetNote} ${RESTART.game}`}
          onClick={onReset}
        >
          {S.resetProfiles}
        </ButtonItem>
      </PanelSectionRow>
      <RemoveData onDone={onRemoved} />
    </>
  );
}
