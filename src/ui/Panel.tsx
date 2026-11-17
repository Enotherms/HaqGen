import { ConfirmModal, DialogButton, PanelSection, PanelSectionRow, showModal } from "@decky/ui";
import { toaster } from "@decky/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaInfoCircle } from "react-icons/fa";
import {
  deleteProfile,
  getScope,
  getState,
  launchOption,
  listGames,
  listProfiles,
  ProfileEntry,
  readLog,
  resetDefaults,
  saveDefault,
  saveProfile,
  ScopeResult,
  setDebugLog,
  setEnabled,
  setGamescopeCompat,
  setup,
  Settings,
  State,
} from "../api";
import { readCache, writeCache } from "../cache";
import { copyText } from "../clipboard";
import {
  creatableGames,
  debounce,
  describeError,
  editTarget,
  layersWarning,
  positionToMultiplier,
  restartBanner,
} from "../logic";
import { S } from "../strings";
import { Advanced } from "./Advanced";
import { InfoContext } from "./info";
import { LaunchSection } from "./LaunchSection";
import { MoreSection } from "./MoreSection";
import { NowPlaying } from "./NowPlaying";
import { loadValue, saveValue } from "./persist";
import { StatusCard } from "./StatusCard";
import { CreateProfile } from "./CreateProfile";
import { ProfilePicker } from "./ProfilePicker";
import { CollapsePill, SectionHeader, ThemeStyle } from "./theme";
import { useRunningGame } from "./useRunningGame";

const KEY_INFO = "haqgen.showInfo";
const KEY_PICKED = "haqgen.pickedProfile";
const KEY_ADVANCED = "haqgen.showAdvanced";
const KEY_MORE = "haqgen.showMore";
const DEFAULT_KEY = 0;

function toast(body: string) {
  toaster.toast({ title: S.title, body });
}

function Notice({ text, strong }: { text: string; strong?: boolean }) {
  return (
    <PanelSectionRow>
      <div style={{ fontSize: 13, fontWeight: strong ? 600 : 400, color: strong ? undefined : "#ffb4a2" }}>{text}</div>
    </PanelSectionRow>
  );
}

export function Panel() {
  const running = useRunningGame();
  const [profiles, setProfiles] = useState<ProfileEntry[]>([{ app_id: null, game: null, label: "Default" }]);
  const [games, setGames] = useState<{ app_id: number; name: string }[]>(readCache().games ?? []);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [picked, setPicked] = useState<ProfileEntry | null>(() => {
    try {
      const raw = loadValue(KEY_PICKED);
      const v = raw ? JSON.parse(raw) : null;
      return v && (typeof v.app_id === "number" || v.app_id === null) ? (v as ProfileEntry) : null;
    } catch {
      return null;
    }
  });
  const target = editTarget(running, picked);
  const appId = target.appId;
  const gameName = target.game;
  const isRunning = running !== null;
  const cacheKey = appId ?? DEFAULT_KEY;

  const [state, setState] = useState<State | null>((readCache().state as State) ?? null);
  const [scope, setScope] = useState<ScopeResult | null>(
    () => (readCache().profiles?.[cacheKey] as ScopeResult) ?? null
  );
  const [message, setMessage] = useState<string | null>(null);
  const [restartFor, setRestartFor] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(() => loadValue(KEY_INFO) === "1");
  const [showAdvanced, setShowAdvanced] = useState(() => loadValue(KEY_ADVANCED) === "1");
  const [showMore, setShowMore] = useState(() => loadValue(KEY_MORE) === "1");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => saveValue(KEY_INFO, showInfo ? "1" : "0"), [showInfo]);
  useEffect(() => saveValue(KEY_PICKED, picked ? JSON.stringify(picked) : null), [picked]);
  useEffect(() => saveValue(KEY_ADVANCED, showAdvanced ? "1" : "0"), [showAdvanced]);
  useEffect(() => saveValue(KEY_MORE, showMore ? "1" : "0"), [showMore]);

  const refresh = useCallback(async () => {
    try {
      const s = await getState();
      writeCache({ state: s });
      if (mounted.current) setState(s);
    } catch (e) {
      if (mounted.current) setMessage(describeError(e));
    }
  }, []);

  const loadScope = useCallback(async () => {
    try {
      const r = await getScope(appId, gameName);
      writeCache({ profile: { appId: appId ?? DEFAULT_KEY, value: r } });
      if (mounted.current) setScope(r);
    } catch (e) {
      if (mounted.current) setMessage(describeError(e));
    }
  }, [appId, gameName]);

  const loadProfiles = useCallback(async () => {
    try {
      const list = await listProfiles();
      if (!mounted.current) return;
      setProfiles(list);
      setPicked((cur) => (cur && cur.app_id !== null && !list.some((p) => p.app_id === cur.app_id) ? null : cur));
    } catch {
    }
  }, []);

  useEffect(() => {
    refresh();
    loadProfiles();
    listGames()
      .then((g) => {
        writeCache({ games: g });
        if (mounted.current) setGames(g);
      })
      .catch(() => {});
  }, [refresh, loadProfiles]);

  useEffect(() => {
    if (savedAt === null) return;
    const t = setTimeout(() => setSavedAt(null), 2500);
    return () => clearTimeout(t);
  }, [savedAt]);

  useEffect(() => {
    setScope((readCache().profiles?.[appId ?? DEFAULT_KEY] as ScopeResult) ?? null);
    setRestartFor(null);
    loadScope();
  }, [loadScope, appId]);

  const needsRestart = useCallback(() => {
    if (isRunning && appId !== null) setRestartFor(appId);
  }, [isRunning, appId]);

  const saveActive = useCallback(
    async (s: Settings) => {
      const own = scope?.scope === "game" && appId !== null && gameName !== null;
      const r = own ? await saveProfile(appId!, gameName!, s) : await saveDefault(s);
      if (!mounted.current) return;
      setMessage(r.ok ? null : describeError(r.error));
      if (r.ok) setSavedAt(Date.now());
      await loadScope();
    },
    [scope?.scope, appId, gameName, loadScope]
  );
  const debouncedSave = useMemo(() => debounce(saveActive, 300), [saveActive]);
  useEffect(() => () => debouncedSave.cancel(), [debouncedSave]);

  const applyMultiplier = useCallback(
    async (position: number) => {
      const multiplier = positionToMultiplier(position);
      const target = scope?.scope === "game" ? appId : null;
      const wasOn = scope?.enabled ?? true;
      const r = await setEnabled(target, multiplier !== null);
      if (multiplier !== null) await saveActive({ multiplier });
      if (!mounted.current) return;
      if (!r.ok) setMessage(describeError(r.error));
      if (wasOn !== (multiplier !== null)) needsRestart();
      await loadScope();
    },
    [scope?.scope, scope?.enabled, appId, saveActive, needsRestart, loadScope]
  );
  const debouncedMultiplier = useMemo(() => debounce(applyMultiplier, 300), [applyMultiplier]);
  useEffect(() => () => debouncedMultiplier.cancel(), [debouncedMultiplier]);

  const onMultiplier = (position: number) => {
    const multiplier = positionToMultiplier(position);
    setScope((s) =>
      s ? { ...s, enabled: multiplier !== null, profile: { ...s.profile, multiplier: multiplier ?? s.profile.multiplier } } : s
    );
    debouncedMultiplier(position);
  };

  const onChange = (s: Settings) => {
    setScope((cur) => (cur ? { ...cur, profile: { ...cur.profile, ...s } as ScopeResult["profile"] } : cur));
    debouncedSave(s);
  };

  const onSaveForGame = async () => {
    if (appId === null || gameName === null) return;
    const r = await saveProfile(appId, gameName, {});
    if (!r.ok) setMessage(describeError(r.error));
    needsRestart();
    await loadScope();
    await loadProfiles();
  };

  const onCreate = async (g: { app_id: number; name: string }) => {
    const r = await saveProfile(g.app_id, g.name, {});
    if (!mounted.current) return;
    if (!r.ok) {
      setMessage(describeError(r.error));
      return;
    }
    toast(S.created(g.name));
    await loadProfiles();
    setPicked({ app_id: g.app_id, game: g.name, label: g.name });
  };

  const onUseDefault = async () => {
    if (appId === null || gameName === null) return;
    const r = await deleteProfile(appId, gameName);
    if (!r.ok) setMessage(describeError(r.error));
    needsRestart();
    if (!isRunning) setPicked(null);
    await loadScope();
    await loadProfiles();
  };

  const onGamescope = async (on: boolean) => {
    setScope((cur) => (cur ? { ...cur, gamescope_compat: on } : cur));
    const target = scope?.scope === "game" ? appId : null;
    const r = await setGamescopeCompat(target, on);
    if (!mounted.current) return;
    if (!r.ok) setMessage(describeError(r.error));
    needsRestart();
    await loadScope();
  };

  const onDebugLog = async (on: boolean) => {
    setState((cur) => (cur ? { ...cur, debug_log: on } : cur));
    const r = await setDebugLog(on);
    if (!mounted.current) return;
    if (!r.ok) setMessage(describeError(r.error));
    needsRestart();
    await refresh();
  };

  const onCopy = async () => {
    const text = await launchOption();
    toast((await copyText(text)) ? S.copied : S.copyFailed(text));
  };

  const onShowLog = async () => {
    const text = await readLog(200);
    showModal(
      <ConfirmModal strTitle={S.logTitle} strOKButtonText={S.close} bAlertDialog>
        <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto" }}>{text || S.logEmpty}</pre>
      </ConfirmModal>
    );
  };

  const onReset = async () => {
    const r = await resetDefaults();
    toast(r.ok ? S.resetDone : describeError(r.error));
    needsRestart();
    setPicked(null);
    await loadScope();
    await loadProfiles();
    await refresh();
  };

  const onSetup = async () => {
    const r = await setup();
    if (!mounted.current) return;
    setMessage(r.ok ? null : describeError(r.error, r.detail));
    if (r.ok) toast(S.setupDone);
    await refresh();
    await loadScope();
  };

  const infoToggle = (
    <PanelSectionRow>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <DialogButton
          onClick={() => setShowInfo((v) => !v)}
          style={{ width: "auto", minWidth: 0, height: 28, minHeight: 28, padding: "0 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
        >
          <FaInfoCircle size={12} /> {showInfo ? S.hideInfo : S.showInfo}
        </DialogButton>
      </div>
    </PanelSectionRow>
  );

  if (!state) {
    return (
      <PanelSection>
        <PanelSectionRow>{message ?? S.loading}</PanelSectionRow>
      </PanelSection>
    );
  }

  const notice = message ?? state.error ?? scope?.error ?? null;
  if (!(state.installed && state.dll_found && state.launcher_installed)) {
    return (
      <>
        <ThemeStyle />
        <StatusCard state={state} notice={notice} onSetup={onSetup} />
      </>
    );
  }
  const banner = restartFor !== null && restartFor === appId && gameName ? restartBanner(gameName) : null;

  return (
    <InfoContext.Provider value={showInfo}>
      <ThemeStyle />
      <PanelSection>
        {infoToggle}
        {notice && <Notice text={notice} />}
        {layersWarning(state.other_layers ?? []) && <Notice text={layersWarning(state.other_layers ?? [])!} />}
        {banner && <Notice strong text={`⟳ ${banner}`} />}
        {scope && (
          <NowPlaying
            scope={scope}
            running={isRunning}
            saved={savedAt !== null}
            picker={
              <>
                <ProfilePicker
                  profiles={profiles}
                  selected={picked?.app_id ?? null}
                  locked={isRunning ? gameName : null}
                  onSelect={(entry) => setPicked(entry.app_id === null ? null : entry)}
                />
                {!isRunning && <CreateProfile games={creatableGames(games, profiles)} onCreate={onCreate} />}
              </>
            }
            onMultiplier={onMultiplier}
            onChange={onChange}
            onSaveForGame={onSaveForGame}
            onUseDefault={onUseDefault}
          />
        )}
        <LaunchSection onCopy={onCopy} />
        {scope?.enabled && (
          <>
            <SectionHeader title={S.advanced} />
            <CollapsePill label={S.advanced} open={showAdvanced} onToggle={() => setShowAdvanced((v) => !v)} />
            {showAdvanced && (
              <Advanced
                profile={scope.profile}
                onChange={onChange}
                gamescope={scope.gamescope_compat}
                onGamescope={onGamescope}
              />
            )}
          </>
        )}
        <SectionHeader title={S.more} />
        <CollapsePill label={S.more} open={showMore} onToggle={() => setShowMore((v) => !v)} />
        {showMore && (
          <MoreSection
            debugLog={state.debug_log ?? false}
            onDebugLog={onDebugLog}
            onShowLog={onShowLog}
            onReset={onReset}
            onRemoved={async () => {
              needsRestart();
              setPicked(null);
              await loadScope();
              await loadProfiles();
              await refresh();
            }}
          />
        )}
      </PanelSection>
    </InfoContext.Provider>
  );
}
