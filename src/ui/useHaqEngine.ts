import { toaster } from "@decky/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { getHaqEngine, HaqEngineStatus, installHaqEngine, removeHaqEngine } from "../api";
import { describeError } from "../logic";
import { S } from "../strings";

export interface HaqEngineControl {
  status: HaqEngineStatus | null;
  busy: boolean;
  install: () => void;
  remove: () => void;
}

/** HaqEngine's install state, shared by the Engine row and the Danger zone so only one action runs at a time. */
export function useHaqEngine(onChanged: () => void): HaqEngineControl {
  const [status, setStatus] = useState<HaqEngineStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const running = useRef(false);

  const load = useCallback(async () => {
    try {
      const s = await getHaqEngine();
      if (mounted.current) setStatus(s);
    } catch {
      if (mounted.current) setStatus(null);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const run = useCallback(
    async (action: () => Promise<HaqEngineStatus>, done: string) => {
      if (running.current) return;
      running.current = true;
      setBusy(true);
      try {
        const r = await action();
        if (r.ok) toaster.toast({ title: S.title, body: done });
        else if (r.error === "install_failed") toaster.toast({ title: S.title, body: `${S.haqengineFailed}: ${r.detail ?? ""}` });
        else toaster.toast({ title: S.title, body: describeError(r.error, r.detail) });
      } catch (e) {
        toaster.toast({ title: S.title, body: describeError(e) });
      } finally {
        running.current = false;
        if (mounted.current) setBusy(false);
        await load();
        onChanged();
      }
    },
    [load, onChanged],
  );

  return {
    status,
    busy,
    install: () => run(installHaqEngine, S.haqengineDone),
    remove: () => run(removeHaqEngine, S.haqengineRemoved),
  };
}
