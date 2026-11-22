import { ConfirmModal, PanelSectionRow, showModal, ToggleField } from "@decky/ui";
import { toaster } from "@decky/api";
import { useState } from "react";
import { healthCheck, resetLsfgConfig } from "../api";
import { describeError } from "../logic";
import { S } from "../strings";
import { useInfo } from "./info";
import { RemoveData } from "./RemoveData";
import { Desc, Hint, PlainButton } from "./theme";
import { HaqEngineControl } from "./useHaqEngine";

function HealthModal({ ok, summary, details, closeModal }: { ok: boolean; summary: string; details: string; closeModal?: () => void }) {
  return (
    <ConfirmModal strTitle={S.healthCheck} strOKButtonText={S.close} bAlertDialog closeModal={closeModal}>
      <p>{ok ? "✓ " : "✗ "}{summary}</p>
      {details && <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 300, overflow: "auto" }}>{details}</pre>}
    </ConfirmModal>
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

export function Troubleshooting({
  debugLog,
  onDebugLog,
  onShowLog,
  onConfigReset,
}: {
  debugLog: boolean;
  onDebugLog: (on: boolean) => void;
  onShowLog: () => void;
  onConfigReset: () => void;
}) {
  const [checking, setChecking] = useState(false);
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
        <ToggleField label={S.debugLog} description={Desc({ text: S.debugLogNote, restart: S.restartGame })} checked={debugLog} onChange={onDebugLog} />
      </PanelSectionRow>
      <PlainButton onClick={onShowLog}>{S.showLog}</PlainButton>
      <ResetConfigButton onDone={onConfigReset} />
    </>
  );
}

export function DangerZone({ onReset, onRemoved, haqengine }: { onReset: () => void; onRemoved: () => void; haqengine: HaqEngineControl }) {
  const resetInfo = useInfo(S.resetInfo);
  return (
    <>
      <PlainButton
        onClick={() =>
          showModal(
            <ConfirmModal strTitle={S.resetConfirmTitle} strOKButtonText={S.resetConfirmOk} strCancelButtonText={S.cancel} onOK={onReset}>
              {S.resetConfirmBody}
            </ConfirmModal>
          )
        }
      >
        {S.resetProfiles}
      </PlainButton>
      {resetInfo && <Hint>{resetInfo}</Hint>}
      {haqengine.status?.installed && (
        <PlainButton
          disabled={haqengine.busy}
          onClick={() =>
            showModal(
              <ConfirmModal
                strTitle={S.haqengineRemoveTitle}
                strOKButtonText={S.haqengineRemove}
                strCancelButtonText={S.cancel}
                onOK={haqengine.remove}
              >
                {S.haqengineRemoveBody}
              </ConfirmModal>
            )
          }
        >
          {S.haqengineRemove}
        </PlainButton>
      )}
      <RemoveData onDone={onRemoved} />
    </>
  );
}
