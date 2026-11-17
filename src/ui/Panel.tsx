import { ConfirmModal, PanelSection, PanelSectionRow, showModal } from "@decky/ui";
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
import { readCache, writeCache } from "../cache";
import {
  buildGameOptions,
  debounce,
  describeError,
  GameEntry,
  gameName as findGameName,
  gamesCountLabel,
  parseStoredAppId,
  positionToMultiplier,
  restartBanner,
} from "../logic";
import { S } from "../strings";
import { Advanced } from "./Advanced";
import { Collapse } from "./Collapse";
import { GameControls } from "./GameControls";
import { GamePicker } from "./GamePicker";
import { MoreSection } from "./MoreSection";
import { loadValue, saveValue } from "./persist";
import { StatusCard } from "./StatusCard";
import { useRunningGame } from "./useRunningGame";

const KEY_GAME = "haqgen.selectedApp";
const KEY_ADVANCED = "haqgen.showAdvanced";
const KEY_MORE = "haqgen.showMore";

function toast(body: string) {
  toaster.toast({ title: S.title, body });
}

function Notice({ text, strong }: { text: string; strong?: boolean }) {
  return (
    <PanelSectionRow>
      <div style={{ fontSize: 13, fontWeight: strong ? 600 : 400, color: strong ? undefined : "#ffb4a2" }}>
        {text}
      </div>
    </PanelSectionRow>
  );
}

export function Panel() {
  const cached = readCache();
  const running = useRunningGame();
  const [state, setState] = useState<State | null>((cached.state as State) ?? null);
  const [games, setGames] = useState<GameEntry[]>(cached.games ?? []);
  const [selectedId, setSelectedId] = useState<number | null>(() => parseStoredAppId(loadValue(KEY_GAME)));
  const [profile, setProfile] = useState<ProfileInfo | null>(() => {
    const id = parseStoredAppId(loadValue(KEY_GAME));
    return id !== null ? ((cached.profiles?.[id] as ProfileInfo) ?? null) : null;
  });
  const [defaultPreset, setDefault] = useState(cached.defaultPreset ?? "balanced");
  const [message, setMessage] = useState<string | null>(null);
  const [restartFor, setRestartFor] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(() => loadValue(KEY_ADVANCED) === "1");
  const [showMore, setShowMore] = useState(() => loadValue(KEY_MORE) === "1");
  const mounted = useRef(true);
  const serverExists = useRef<boolean | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await getState();
      writeCache({ state: s });
      if (mounted.current) setState(s);
    } catch (e) {
      if (mounted.current) setMessage(describeError(e));
    }
  }, []);

  useEffect(() => {
    refresh();
    listGames()
      .then((g) => {
        writeCache({ games: g });
        if (mounted.current) setGames(g);
      })
      .catch(() => {});
    getSettings()
      .then((s) => {
        writeCache({ defaultPreset: s.default_preset });
        if (mounted.current) setDefault(s.default_preset);
      })
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
  const appId = selectedId ?? undefined;
  const gameName = appId !== undefined ? findGameName(games, running, appId) ?? undefined : undefined;
  const gameRunning = appId !== undefined && appId === runningId;

  const loadProfile = useCallback(async () => {
    if (appId === undefined || gameName === undefined) {
      setProfile(null);
      return;
    }
    try {
      const p = await getProfile(appId, gameName);
      serverExists.current = p.exists;
      writeCache({ profile: { appId, value: p } });
      if (mounted.current) setProfile(p);
    } catch (e) {
      if (mounted.current) setMessage(describeError(e));
    }
  }, [appId, gameName]);

  useEffect(() => {
    const hit = appId !== undefined ? (readCache().profiles?.[appId] as ProfileInfo | undefined) : undefined;
    setProfile(hit ?? null);
    serverExists.current = null;
    loadProfile();
  }, [loadProfile]);

  const needsRestart = useCallback(() => {
    if (gameRunning && appId !== undefined) setRestartFor(appId);
  }, [gameRunning, appId]);

  const save = useCallback(
    async (s: Settings) => {
      if (appId === undefined || gameName === undefined) return;
      const r = await saveProfile(appId, gameName, s);
      if (!mounted.current) return;
      if (!r.ok) setMessage(describeError(r.error));
      else setMessage(null);
      await loadProfile();
    },
    [appId, gameName, loadProfile]
  );

  const debouncedSave = useMemo(() => debounce(save, 300), [save]);
  useEffect(() => () => debouncedSave.cancel(), [debouncedSave]);

  const applyMultiplier = useCallback(
    async (position: number) => {
      if (appId === undefined || gameName === undefined) return;
      const multiplier = positionToMultiplier(position);
      const wasOn = serverExists.current === true;
      const r =
        multiplier === null
          ? await deleteProfile(appId, gameName)
          : await saveProfile(appId, gameName, { multiplier });
      if (!mounted.current) return;
      if (!r.ok) setMessage(describeError(r.error));
      if (wasOn !== (multiplier !== null)) needsRestart();
      await loadProfile();
      await refresh();
    },
    [appId, gameName, loadProfile, needsRestart, refresh]
  );
  const debouncedMultiplier = useMemo(() => debounce(applyMultiplier, 300), [applyMultiplier]);
  useEffect(() => () => debouncedMultiplier.cancel(), [debouncedMultiplier]);

  const onMultiplier = (position: number) => {
    const multiplier = positionToMultiplier(position);
    setProfile((p) =>
      p ? { ...p, exists: multiplier !== null, multiplier: multiplier ?? p.multiplier } : p
    );
    debouncedMultiplier(position);
  };

  const changeInstant = (s: Settings) => {
    setProfile((p) => (p ? ({ ...p, ...s } as ProfileInfo) : p));
    debouncedSave(s);
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
    await onProcessNames(Array.from(new Set([...profile.exe_names, r.exe])));
    toast(S.detectFound(r.exe));
  };

  const onCopyLaunchOption = async () => {
    if (appId === undefined || gameName === undefined) return;
    const text = await launchOption(appId, gameName);
    try {
      await navigator.clipboard.writeText(text);
      toast(S.copied);
    } catch {
      toast(S.copyFailed(text));
    }
  };

  const onShowLog = async () => {
    const text = await readLog(200);
    showModal(
      <ConfirmModal strTitle={S.logTitle} strOKButtonText={S.close} bAlertDialog>
        <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto" }}>
          {text || S.logEmpty}
        </pre>
      </ConfirmModal>
    );
  };

  const onReset = async () => {
    const r = await resetDefaults();
    toast(r.ok ? S.resetDone : describeError(r.error));
    needsRestart();
    await loadProfile();
    await refresh();
  };

  const onDefaultPreset = async (preset: string) => {
    setDefault(preset);
    writeCache({ defaultPreset: preset });
    const r = await setDefaultPreset(preset);
    if (!r.ok) toast(describeError(r.error));
  };

  const onSetup = async () => {
    const r = await setup();
    if (!mounted.current) return;
    setMessage(r.ok ? null : describeError(r.error, r.detail));
    if (r.ok) toast(S.setupDone);
    await refresh();
  };

  if (!state) {
    return (
      <PanelSection title={S.title}>
        <PanelSectionRow>{message ?? S.loading}</PanelSectionRow>
      </PanelSection>
    );
  }

  const notice = message ?? state.error;

  if (!(state.installed && state.dll_found)) {
    return <StatusCard state={state} notice={notice} onSetup={onSetup} />;
  }

  const banner = restartFor !== null && restartFor === appId && gameName ? restartBanner(gameName) : null;

  return (
    <>
      <PanelSection title={S.title}>
        {notice && <Notice text={notice} />}
        {banner && <Notice strong text={`⟳ ${banner}`} />}
        <GamePicker
          options={options}
          selectedId={selectedId}
          selectedName={gameName ?? null}
          countLabel={gamesCountLabel(games.length)}
          onSelect={setSelectedId}
        />
        {!gameName && <PanelSectionRow>{S.pickGameHint}</PanelSectionRow>}
        {gameName && profile && (
          <GameControls
            gameName={gameName}
            running={gameRunning}
            profile={profile}
            onMultiplier={onMultiplier}
            onChange={changeInstant}
          />
        )}
      </PanelSection>
      {gameName && profile?.exists && (
        <PanelSection>
          <Collapse label={S.advanced} open={showAdvanced} onToggle={() => setShowAdvanced((v) => !v)} />
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
      <PanelSection>
        <Collapse label={S.more} open={showMore} onToggle={() => setShowMore((v) => !v)} />
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
