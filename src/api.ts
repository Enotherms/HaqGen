import { callable } from "@decky/api";

export interface State {
  installed: boolean;
  dll_found: boolean;
  dll_path: string | null;
  profiles: string[];
  launcher_installed: boolean;
  wrong_branch: boolean;
  ls_branch: { installed: boolean; selected: string | null; current: string | null };
  other_layers: string[];
  debug_log: boolean;
  error: string | null;
}

export interface ProfileInfo {
  exists: boolean;
  preset: string | null;
  name: string;
  multiplier: number;
  flow_scale: number;
  performance_mode: boolean;
  exe_names: string[];
  error?: string;
}

export interface Settings {
  preset?: string;
  multiplier?: number;
  flow_scale?: number;
  performance_mode?: boolean;
  exe_names?: string[];
}

export interface Result {
  ok: boolean;
  error?: string;
  detail?: string;
}

export interface RemovalPreview {
  delete: string[];
  missing: string[];
  refused: { path: string; reason: string }[];
  profiles: string[];
  flatpak_apps?: string[];
  flatpak_extensions?: string[];
}

export const listGames = callable<[], { app_id: number; name: string }[]>("list_games");
export const getState = callable<[], State>("get_state");
export const setup = callable<[], Result>("setup");
export const getProfile = callable<[number, string], ProfileInfo>("get_profile");
export const saveProfile = callable<[number, string, Settings], Result>("save_profile");
export const deleteProfile = callable<[number, string], Result>("delete_profile");
export const launchOption = callable<[], string>("launch_option");
export const removalPreview = callable<[], RemovalPreview>("removal_preview");
export const removeAll = callable<[boolean], Result>("remove_all");
export const readLog = callable<[number], string>("read_log");
export const resetDefaults = callable<[], Result>("reset_defaults");
export const resetLsfgConfig = callable<[], Result & { backup?: string | null }>("reset_lsfg_config");

export interface HealthResult {
  ok: boolean;
  summary: string;
  details: string;
}

export const getSettings = callable<[], { default_preset: string }>("get_settings");
export const setDefaultPreset = callable<[string], Result>("set_default_preset");
export const healthCheck = callable<[], HealthResult>("health_check");

export interface ScopeResult {
  scope: "default" | "game";
  game: string | null;
  profile: ProfileInfo;
  enabled: boolean;
  gamescope_compat: boolean;
  fps_cap: number;
  engine: "lsfg" | "haqengine";
  haqengine_multiplier: number | null;
  error: string | null;
}

export const getScope = callable<[number | null, string | null], ScopeResult>("get_scope");
export const saveDefault = callable<[Settings], Result>("save_default");
export const setFpsCap = callable<[number | null, number], Result>("set_fps_cap");
export const setEngine = callable<[number | null, string, number], Result>("set_engine");
export interface FlatpakApp {
  app_id: string;
  name: string;
  branch: string | null;
  supported: boolean;
  enabled: boolean;
}
export const flatpakState = callable<[], { available: boolean; apps: FlatpakApp[] }>("flatpak_state");
export const flatpakSet = callable<[string, boolean], Result>("flatpak_set");
export const setEnabled = callable<[number | null, boolean], Result>("set_enabled");
export const setDebugLog = callable<[boolean], Result>("set_debug_log");
export const setGamescopeCompat = callable<[number | null, boolean], Result>("set_gamescope_compat");

export interface ProfileEntry {
  app_id: number | null;
  game: string | null;
  label: string;
}

export const listProfiles = callable<[], ProfileEntry[]>("list_profiles");
