import { toaster } from "@decky/api";
import { useEffect, useRef, useState } from "react";
import { getHaqEngine, HaqEngineStatus, installHaqEngine, removeHaqEngine } from "../api";
import { describeError, haqengineAction } from "../logic";
import { S } from "../strings";
import { useInfo } from "./info";
import { DangerButton, Hint, PrimaryButton } from "./theme";

export function HaqEngineSection(props: { onChanged: () => void }) {
  const [status, setStatus] = useState<HaqEngineStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const hint = useInfo(S.haqengineHint);

  const load = async () => {
    try {
      const s = await getHaqEngine();
      if (mounted.current) setStatus(s);
    } catch (e) {
      if (mounted.current) toaster.toast({ title: S.title, body: describeError(e) });
    }
  };

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = async (action: () => Promise<HaqEngineStatus>, done: string) => {
    setBusy(true);
    try {
      const r = await action();
      if (r.ok) {
        toaster.toast({ title: S.title, body: done });
      } else if (r.error === "install_failed") {
        toaster.toast({ title: S.title, body: `${S.haqengineFailed}: ${r.detail ?? ""}` });
      } else {
        toaster.toast({ title: S.title, body: describeError(r.error, r.detail) });
      }
    } catch (e) {
      toaster.toast({ title: S.title, body: describeError(e) });
    } finally {
      if (mounted.current) setBusy(false);
      await load();
      props.onChanged();
    }
  };

  if (status === null) return <Hint>{S.haqengineLoading}</Hint>;
  const action = haqengineAction(status);
  return (
    <>
      <Hint>{action.line}</Hint>
      {hint && <Hint>{hint}</Hint>}
      <PrimaryButton disabled={busy} onClick={() => run(installHaqEngine, S.haqengineDone)}>
        {busy ? S.haqengineInstalling : action.label}
      </PrimaryButton>
      {status.installed && (
        <DangerButton disabled={busy} onClick={() => run(removeHaqEngine, S.haqengineRemoved)}>
          {S.haqengineRemove}
        </DangerButton>
      )}
    </>
  );
}
