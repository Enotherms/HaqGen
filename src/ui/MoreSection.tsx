import { ConfirmModal, PanelSectionRow, showModal, ToggleField } from "@decky/ui";
import { useState } from "react";
import { healthCheck, resetLsfgConfig } from "../api";
import { describeError } from "../logic";
import { toaster } from "@decky/api";
import { S } from "../strings";
import { useInfo } from "./info";
import { RemoveData } from "./RemoveData";
import { Hint, PlainButton } from "./theme";

interface Props {
  debugLog: boolean;
  onDebugLog: (on: boolean) => void;
  onShowLog: () => void;
  onReset: () => void;
  onConfigReset: () => void;
  onRemoved: () => void;
}

function HealthModal({ ok, summary, details, closeModal }: { ok: boolean; summary: string; details: string; closeModal?: () => void }) {
  return (
    <ConfirmModal strTitle={S.healthCheck} strOKButtonText={S.close} bAlertDialog closeModal={closeModal}>
      <p>{ok ? "✓ " : "✗ "}{summary}</p>
      {details && (
        <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 300, overflow: "auto" }}>{details}</pre>
      )}
    </ConfirmModal>
  );
}

export function MoreSection({ debugLog, onDebugLog, onShowLog, onReset, onConfigReset, onRemoved }: Props) {
  const [checking, setChecking] = useState(false);
  const resetInfo = useInfo(S.resetInfo);
  return (
    <>
      <PlainButton
        disabled={checking}
        onClick={async () => {
          setChecking(true);
          try {
            showModal(<HealthModal {...await healthCheck()} />);
          } finally {
            setChecking(false);
          }
        }}
      >
        {checking ? S.checking : S.healthCheck}
      </PlainButton>
      <PanelSectionRow>
        <ToggleField label={S.debugLog} description={S.debugLogNote} checked={debugLog} onChange={onDebugLog} />
      </PanelSectionRow>
      <PlainButton onClick={onShowLog}>{S.showLog}</PlainButton>
      <PlainButton
        onClick={() =>
          showModal(
            <ConfirmModal
              strTitle={S.resetConfirmTitle}
              strOKButtonText={S.resetConfirmOk}
              strCancelButtonText={S.cancel}
              onOK={onReset}
            >
              {S.resetConfirmBody}
            </ConfirmModal>
          )
        }
      >
        {S.resetProfiles}
      </PlainButton>
      {resetInfo && <Hint>{resetInfo}</Hint>}
      <ResetConfigButton onDone={onConfigReset} />
      <RemoveData onDone={onRemoved} />
    </>
  );
}

export function ResetConfigButton({ onDone }: { onDone: () => void }) {
  const info = useInfo(S.resetConfigInfo);
  return (
    <>
      <PlainButton
        onClick={async () => {
          const r = await resetLsfgConfig();
          toaster.toast({ title: S.title, body: r.ok ? S.resetConfigDone(r.backup) : describeError(r.error) });
          onDone();
        }}
      >
        {S.resetConfig}
      </PlainButton>
      {info && <Hint>{info}</Hint>}
    </>
  );
}
