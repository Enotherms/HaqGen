import { callable } from "@decky/api";

export interface State {
  installed: boolean;
  dll_found: boolean;
  dll_path: string | null;
  profiles: string[];
  error: string | null;
}

export interface ProfileInfo {
  exists: boolean;
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
}

export const getState = callable<[], State>("get_state");
export const setup = callable<[], Result>("setup");
export const getProfile = callable<[number, string], ProfileInfo>("get_profile");
export const saveProfile = callable<[number, string, Settings], Result>("save_profile");
export const deleteProfile = callable<[number, string], Result>("delete_profile");
export const launchOption = callable<[number, string], string>("launch_option");
export const removalPreview = callable<[], RemovalPreview>("removal_preview");
export const removeAll = callable<[boolean], Result>("remove_all");
export const readLog = callable<[number], string>("read_log");
export const resetDefaults = callable<[], Result>("reset_defaults");
