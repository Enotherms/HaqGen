import { ConfirmModal, showModal } from "@decky/ui";
import { useState } from "react";
import { healthCheck } from "../api";
import { S } from "../strings";
import { useInfo } from "./info";
import { RemoveData } from "./RemoveData";
import { Hint, PlainButton } from "./theme";

interface Props {
  onShowLog: () => void;
  onReset: () => void;
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

export function MoreSection({ onShowLog, onReset, onRemoved }: Props) {
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
      <PlainButton onClick={onShowLog}>{S.showLog}</PlainButton>
      <PlainButton onClick={onReset}>{S.resetProfiles}</PlainButton>
      {resetInfo && <Hint>{resetInfo}</Hint>}
      <RemoveData onDone={onRemoved} />
    </>
  );
}
