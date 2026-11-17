import {
  ButtonItem,
  ConfirmModal,
  DropdownItem,
  PanelSection,
  PanelSectionRow,
  Router,
  showModal,
  ToggleField,
} from "@decky/ui";
import { toaster } from "@decky/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteProfile,
  getProfile,
  getState,
  launchOption,
  listGames,
  ProfileInfo,
  readLog,
  resetDefaults,
  saveProfile,
  setup,
  Settings,
  State,
} from "../api";
import {
  buildGameOptions,
  debounce,
  describeError,
  GameEntry,
  parseStoredAppId,
  PRESET_LABELS,
} from "../logic";
import { Advanced } from "./Advanced";
import { RemoveData } from "./RemoveData";

function useRunningGame() {
  const [game, setGame] = useState<{ appId: number; name: string } | null>(null);
  useEffect(() => {
    const read = () => {
      const app = Router.MainRunningApp;
      const next = app ? { appId: Number(app.appid), name: app.display_name } : null;
      setGame((prev) =>
        prev?.appId === next?.appId && prev?.name === next?.name ? prev : next
      );
    };
    read();
    const id = setInterval(read, 2000);
    return () => clearInterval(id);
  }, []);
  return game;
}

const STORE_KEY = "haqgen.selectedApp";

function loadSelected(): number | null {
  try {
    return parseStoredAppId(window.localStorage.getItem(STORE_KEY));
  } catch {
    return null;
  }
}

function saveSelected(id: number | null) {
  try {
    if (id === null) window.localStorage.removeItem(STORE_KEY);
    else window.localStorage.setItem(STORE_KEY, String(id));
  } catch {
  }
}

function toast(body: string) {
  toaster.toast({ title: "HaqGen", body });
}

export function Panel() {
  const running = useRunningGame();
  const [games, setGames] = useState<GameEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(loadSelected());
  const [state, setState] = useState<State | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await getState();
      if (mounted.current) setState(s);
    } catch (e) {
      if (mounted.current) setMessage(describeError(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    listGames()
      .then((g) => {
        if (!cancelled) setGames(g);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const runningId = running?.appId;
  useEffect(() => {
    if (runningId !== undefined) setSelectedId(runningId);
  }, [runningId]);

  useEffect(() => {
    saveSelected(selectedId);
  }, [selectedId]);

  const options = useMemo(() => buildGameOptions(games, running), [games, running]);
  const game = useMemo(() => {
    if (selectedId === null) return null;
    const found = options.find((o) => o.data === selectedId);
    if (!found) return null;
    return { appId: selectedId, name: found.label.replace(/ \(running\)$/, "") };
  }, [options, selectedId]);

  const appId = game?.appId;
  const gameName = game?.name;
  useEffect(() => {
    if (appId === undefined || gameName === undefined) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    getProfile(appId, gameName)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((e) => {
        if (!cancelled) setMessage(describeError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [appId, gameName, state?.profiles.length]);

  const save = useCallback(
    async (s: Settings) => {
      if (appId === undefined || gameName === undefined) return;
      const r = await saveProfile(appId, gameName, s);
      if (!mounted.current) return;
      if (!r.ok) setMessage(describeError(r.error));
      else {
        setMessage(null);
        await refresh();
      }
    },
    [appId, gameName, refresh]
  );

  const debouncedSave = useMemo(() => debounce(save, 300), [save]);
  useEffect(() => () => debouncedSave.cancel(), [debouncedSave]);

  const change = (s: Settings) => {
    setProfile((p) => (p ? { ...p, ...s, exists: true } as ProfileInfo : p));
    debouncedSave(s);
  };

  const onSetup = async () => {
    const r = await setup();
    if (!mounted.current) return;
    setMessage(r.ok ? null : describeError(r.error, r.detail));
    await refresh();
  };

  const onToggle = async (on: boolean) => {
    if (appId === undefined || gameName === undefined) return;
    const r = on
      ? await saveProfile(appId, gameName, { preset: "balanced" })
      : await deleteProfile(appId, gameName);
    if (!mounted.current) return;
    if (!r.ok) setMessage(describeError(r.error));
    await refresh();
  };

  const onCopy = async () => {
    if (appId === undefined || gameName === undefined) return;
    const text = await launchOption(appId, gameName);
    try {
      await navigator.clipboard.writeText(text);
      toast("Launch option copied.");
    } catch {
      toast(`Copy failed. Use this launch option: ${text}`);
    }
  };

  const onLog = async () => {
    const text = await readLog(200);
    showModal(
      <ConfirmModal strTitle="HaqGen log" strOKButtonText="Close" bAlertDialog>
        <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto" }}>
          {text || "The log is empty."}
        </pre>
      </ConfirmModal>
    );
  };

  const onReset = async () => {
    const r = await resetDefaults();
    toast(r.ok ? "HaqGen profiles reset." : describeError(r.error));
    await refresh();
  };

  if (!state) {
    return (
      <PanelSection title="HaqGen">
        <PanelSectionRow>{message ?? "Loading..."}</PanelSectionRow>
      </PanelSection>
    );
  }

  const ready = state.installed && state.dll_found;

  return (
    <>
      <PanelSection title="HaqGen">
        {(message || state.error) && (
          <PanelSectionRow>
            <div style={{ color: "#ffb4a2" }}>{message ?? state.error}</div>
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            lsfg-vk: {state.installed ? "found" : "not found"} | Lossless Scaling DLL:{" "}
            {state.dll_found ? "found" : "not found"}
          </div>
        </PanelSectionRow>
        {!ready && (
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={onSetup}>
              Set up
            </ButtonItem>
          </PanelSectionRow>
        )}
        {ready && (
          <PanelSectionRow>
            <DropdownItem
              label="Game"
              rgOptions={options}
              selectedOption={selectedId}
              strDefaultLabel="Pick a game"
              onChange={(o) => setSelectedId(o.data as number)}
            />
          </PanelSectionRow>
        )}
        {ready && !game && (
          <PanelSectionRow>Pick a game above to set up its profile.</PanelSectionRow>
        )}
        {ready && game && profile && (
          <>
            <PanelSectionRow>
              <ToggleField
                label={`Frame generation: ${game.name}`}
                checked={profile.exists}
                onChange={onToggle}
              />
            </PanelSectionRow>
            {profile.exists && (
              <>
                {Object.entries(PRESET_LABELS).map(([key, label]) => (
                  <PanelSectionRow key={key}>
                    <ButtonItem layout="below" onClick={() => change({ preset: key } as Settings)}>
                      {label}
                    </ButtonItem>
                  </PanelSectionRow>
                ))}
                <PanelSectionRow>
                  <ButtonItem layout="below" onClick={onCopy}>
                    Copy launch option
                  </ButtonItem>
                </PanelSectionRow>
                <PanelSectionRow>
                  <ToggleField
                    label="Advanced"
                    checked={showAdvanced}
                    onChange={setShowAdvanced}
                  />
                </PanelSectionRow>
                {showAdvanced && (
                  <Advanced
                    profile={profile}
                    dllPath={state.dll_path}
                    onChange={change}
                    onShowLog={onLog}
                    onReset={onReset}
                  />
                )}
              </>
            )}
          </>
        )}
      </PanelSection>
      {ready && (
        <PanelSection title="Maintenance">
          <RemoveData onDone={refresh} />
        </PanelSection>
      )}
    </>
  );
}
