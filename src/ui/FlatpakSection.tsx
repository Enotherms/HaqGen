import { PanelSectionRow, ToggleField } from "@decky/ui";
import { toaster } from "@decky/api";
import { useEffect, useRef, useState } from "react";
import { FlatpakApp, flatpakSet, flatpakState } from "../api";
import { describeError } from "../logic";
import { S } from "../strings";
import { Desc, Hint } from "./theme";

export function FlatpakSection() {
  const [apps, setApps] = useState<FlatpakApp[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = async () => {
    try {
      const s = await flatpakState();
      if (!mounted.current) return;
      setAvailable(s.available);
      setApps(s.apps);
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

  const toggle = async (app: FlatpakApp, on: boolean) => {
    setBusy(app.app_id);
    setApps((cur) => cur?.map((a) => (a.app_id === app.app_id ? { ...a, enabled: on } : a)) ?? cur);
    try {
      const r = await flatpakSet(app.app_id, on);
      if (!r.ok) toaster.toast({ title: S.title, body: describeError(r.error, r.detail) });
    } finally {
      if (mounted.current) setBusy(null);
      await load();
    }
  };

  if (!available) return <Hint>{S.flatpakMissing}</Hint>;
  if (apps === null) return <Hint>{S.flatpakLoading}</Hint>;
  if (apps.length === 0) return <Hint>{S.flatpakNone}</Hint>;
  return (
    <>
      <Hint>{Desc({ text: S.flatpakHint, restart: S.restartApp })}</Hint>
      {busy && <Hint>{S.flatpakInstalling}</Hint>}
      {apps.map((app) => (
        <PanelSectionRow key={app.app_id}>
          <ToggleField
            label={app.name}
            description={app.supported ? undefined : S.flatpakUnsupported}
            checked={app.enabled}
            disabled={!app.supported || busy !== null}
            onChange={(on) => toggle(app, on)}
          />
        </PanelSectionRow>
      ))}
    </>
  );
}
