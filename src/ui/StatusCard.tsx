import { ButtonItem, PanelSection, PanelSectionRow } from "@decky/ui";
import { useState } from "react";
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from "react-icons/fa";
import { State } from "../api";
import { C } from "../colors";
import { branchMessage, RESTART } from "../logic";
import { S } from "../strings";


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
        borderTop: first ? "none" : `1px solid ${C.bg}`,
      }}
    >
      <Icon
        aria-hidden
        style={{ flex: "0 0 15px", color: state === "ready" ? C.success : state === "warning" ? C.warning : C.danger }}
      />
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
            background: C.surface,
            overflow: "hidden",
          }}
        >
          {(() => {
            const b = branchMessage(state.ls_branch, state.dll_found);
            return <Row first state={b.ok ? "ready" : state.ls_branch.installed ? "warning" : "missing"} text={b.text} />;
          })()}
          <Row state={state.installed ? "ready" : "missing"} text={state.installed ? S.lsfgFound : S.lsfgMissing} />
          <Row
            state={state.launcher_installed ? "ready" : "missing"}
            text={state.launcher_installed ? S.launcherFound : S.launcherMissing}
          />
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
