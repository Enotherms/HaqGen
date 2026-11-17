import { ButtonItem, PanelSection, PanelSectionRow } from "@decky/ui";
import { useState } from "react";
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from "react-icons/fa";
import { State } from "../api";
import { RESTART } from "../logic";
import { S } from "../strings";

const READY = "#65b9c9";
const PROBLEM = "#d9a35b";

type RowState = "ready" | "missing" | "warning";

function Row({ state, text, first }: { state: RowState; text: string; first?: boolean }) {
  const Icon = state === "ready" ? FaCheckCircle : state === "missing" ? FaTimesCircle : FaExclamationTriangle;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "8px 10px",
        fontSize: 13,
        lineHeight: 1.3,
        borderTop: first ? "none" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <Icon aria-hidden style={{ flex: "0 0 15px", color: state === "ready" ? READY : PROBLEM }} />
      <span>{text}</span>
    </div>
  );
}

export function StatusCard({
  state,
  notice,
  onSetup,
}: {
  state: State;
  notice: string | null;
  onSetup: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <PanelSection title={S.setupTitle}>
      <PanelSectionRow>
        <div
          style={{
            width: "100%",
            boxSizing: "border-box",
            borderRadius: 6,
            border: "1px solid rgba(101,185,201,0.25)",
            background: "rgba(101,185,201,0.07)",
            overflow: "hidden",
          }}
        >
          <Row first state={state.dll_found ? "ready" : "missing"} text={state.dll_found ? S.dllFound : S.dllMissing} />
          <Row state={state.installed ? "ready" : "missing"} text={state.installed ? S.lsfgFound : S.lsfgMissing} />
          {notice && <Row state="warning" text={notice} />}
        </div>
      </PanelSectionRow>
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
          {busy ? S.settingUp : S.setup}
        </ButtonItem>
      </PanelSectionRow>
    </PanelSection>
  );
}
