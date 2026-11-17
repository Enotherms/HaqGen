import {
  ButtonItem,
  ConfirmModal,
  DropdownItem,
  PanelSection,
  PanelSectionRow,
  showModal,
} from "@decky/ui";
import { toaster } from "@decky/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteProfile,
  detectProcess,
  getProfile,
  getSettings,
  getState,
  launchOption,
  listGames,
  ProfileInfo,
  readLog,
  resetDefaults,
  saveProfile,
  setDefaultPreset,
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
  restartBanner,
} from "../logic";
import { Advanced } from "./Advanced";
import { GameControls } from "./GameControls";
import { MoreSection } from "./MoreSection";
import { loadValue, saveValue } from "./persist";
import { SetupCard } from "./SetupCard";
import { useRunningGame } from "./useRunningGame";

const KEY_GAME = "haqgen.selectedApp";
const KEY_ADVANCED = "haqgen.showAdvanced";
const KEY_MORE = "haqgen.showMore";

function toast(body: string) {
  toaster.toast({ title: "HaqGen", body });
}

function Disclosure({ open, label, onToggle }: { open: boolean; label: string; onToggle: () => void }) {
  return (
    <PanelSectionRow>
      <ButtonItem layout="below" onClick={onToggle}>
        {open ? `Hide ${label}` : `Show ${label}`}
      </ButtonItem>
    </PanelSectionRow>
  );
}

export function Panel() {
  const running = useRunningGame();
  const [state, setState] = useState<State | null>(null);
  const [games, setGames] = useState<GameEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(() => parseStoredAppId(loadValue(KEY_GAME)));
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [defaultPreset, setDefault] = useState("balanced");
  const [message, setMessage] = useState<string | null>(null);
  const [restartFor, setRestartFor] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(() => loadValue(KEY_ADVANCED) === "1");
  const [showMore, setShowMore] = useState(() => loadValue(KEY_MORE) === "1");
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
    listGames()
      .then((g) => mounted.current && setGames(g))
      .catch(() => {});
    getSettings()
      .then((s) => mounted.current && setDefault(s.default_preset))
      .catch(() => {});
  }, [refresh]);

  const runningId = running?.appId;
  useEffect(() => {
    if (runningId !== undefined) setSelectedId(runningId);
    setRestartFor(null);
  }, [runningId]);

  useEffect(() => saveValue(KEY_GAME, selectedId === null ? null : String(selectedId)), [selectedId]);
  useEffect(() => saveValue(KEY_ADVANCED, showAdvanced ? "1" : "0"), [showAdvanced]);
  useEffect(() => saveValue(KEY_MORE, showMore ? "1" : "0"), [showMore]);

  const options = useMemo(() => buildGameOptions(games, running), [games, running]);
  const game = useMemo(() => {
    if (selectedId === null) return null;
    const found = options.find((o) => o.data === selectedId);
    return found ? { appId: selectedId, name: found.label.replace(/ \(running\)$/, "") } : null;
  }, [options, selectedId]);
  const appId = game?.appId;
  const gameName = game?.name;
  const gameRunning = appId !== undefined && appId === runningId;

  const loadProfile = useCallback(async () => {
    if (appId === undefined || gameName === undefined) {
      setProfile(null);
      return;
    }
    try {
      const p = await getProfile(appId, gameName);
      if (mounted.current) setProfile(p);
    } catch (e) {
      if (mounted.current) setMessage(describeError(e));
    }
  }, [appId, gameName]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const needsRestart = () => {
    if (gameRunning && appId !== undefined) setRestartFor(appId);
  };

  const save = useCallback(
    async (s: Settings) => {
      if (appId === undefined || gameName === undefined) return;
      const r = await saveProfile(appId, gameName, s);
      if (!mounted.current) return;
      if (!r.ok) setMessage(describeError(r.error));
      else {
        setMessage(null);
        await loadProfile();
      }
    },
    [appId, gameName, loadProfile]
  );

  const debouncedSave = useMemo(() => debounce(save, 300), [save]);
  useEffect(() => () => debouncedSave.cancel(), [debouncedSave]);

  const changeInstant = (s: Settings) => {
    setProfile((p) => (p ? ({ ...p, ...s } as ProfileInfo) : p));
    debouncedSave(s);
  };

  const onToggle = async (on: boolean) => {
    if (appId === undefined || gameName === undefined) return;
    const r = on ? await saveProfile(appId, gameName, {}) : await deleteProfile(appId, gameName);
    if (!mounted.current) return;
    if (!r.ok) setMessage(describeError(r.error));
    needsRestart();
    await loadProfile();
    await refresh();
  };

  const onProcessNames = async (names: string[]) => {
    await save({ exe_names: names });
    needsRestart();
  };

  const onDetect = async () => {
    if (appId === undefined || !profile) return;
    const r = await detectProcess(appId);
    if (!mounted.current) return;
    if (!r.ok || !r.exe) {
      toast(describeError(r.error));
      return;
    }
    const names = Array.from(new Set([...profile.exe_names, r.exe]));
    await onProcessNames(names);
    toast(`Found ${r.exe}.`);
  };

  const onCopyLaunchOption = async () => {
    if (appId === undefined || gameName === undefined) return;
    const text = await launchOption(appId, gameName);
    try {
      await navigator.clipboard.writeText(text);
      toast("Launch option copied. Paste it in the game's Properties > Launch Options.");
    } catch {
      toast(`Copy failed. Use this launch option: ${text}`);
    }
  };

  const onShowLog = async () => {
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
    needsRestart();
    await loadProfile();
    await refresh();
  };

  const onDefaultPreset = async (preset: string) => {
    setDefault(preset);
    const r = await setDefaultPreset(preset);
    if (!r.ok) toast(describeError(r.error));
  };

  const onSetup = async () => {
    const r = await setup();
    if (!mounted.current) return;
    setMessage(r.ok ? null : describeError(r.error, r.detail));
    if (r.ok) toast("Setup complete.");
    await refresh();
  };

  if (!state) {
    return (
      <PanelSection title="HaqGen">
        <PanelSectionRow>{message ?? "Loading..."}</PanelSectionRow>
      </PanelSection>
    );
  }

  const notice = message ?? state.error;
  const banner = restartFor !== null && restartFor === appId && gameName ? restartBanner(gameName) : null;

  if (!(state.installed && state.dll_found)) {
    return (
      <>
        {notice && (
          <PanelSection>
            <PanelSectionRow>
              <div style={{ color: "#ffb4a2", fontSize: 13 }}>{notice}</div>
            </PanelSectionRow>
          </PanelSection>
        )}
        <SetupCard state={state} onSetup={onSetup} />
      </>
    );
  }

  return (
    <>
      <PanelSection title="HaqGen">
        {notice && (
          <PanelSectionRow>
            <div style={{ color: "#ffb4a2", fontSize: 13 }}>{notice}</div>
          </PanelSectionRow>
        )}
        {banner && (
          <PanelSectionRow>
            <div style={{ fontSize: 13, fontWeight: 600 }}>⟳ {banner}</div>
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <DropdownItem
            label="Game"
            rgOptions={options}
            selectedOption={selectedId}
            strDefaultLabel="Pick a game"
            onChange={(o) => setSelectedId(o.data as number)}
          />
        </PanelSectionRow>
        {!game && <PanelSectionRow>Pick a game to set up frame generation.</PanelSectionRow>}
        {game && profile && (
          <GameControls profile={profile} onToggle={onToggle} onChange={changeInstant} />
        )}
      </PanelSection>
      {game && profile?.exists && (
        <PanelSection title="Advanced">
          <Disclosure open={showAdvanced} label="advanced settings" onToggle={() => setShowAdvanced((v) => !v)} />
          {showAdvanced && (
            <Advanced
              profile={profile}
              gameRunning={gameRunning}
              onChange={changeInstant}
              onProcessNames={onProcessNames}
              onDetect={onDetect}
              onCopyLaunchOption={onCopyLaunchOption}
            />
          )}
        </PanelSection>
      )}
      <PanelSection title="More">
        <Disclosure open={showMore} label="more options" onToggle={() => setShowMore((v) => !v)} />
        {showMore && (
          <MoreSection
            defaultPreset={defaultPreset}
            onDefaultPreset={onDefaultPreset}
            onShowLog={onShowLog}
            onReset={onReset}
            onRemoved={async () => {
              needsRestart();
              await loadProfile();
              await refresh();
            }}
          />
        )}
      </PanelSection>
    </>
  );
}
