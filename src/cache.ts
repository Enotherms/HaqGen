const MAX_PROFILES = 20;

export interface PanelCache {
  state?: unknown;
  games?: { app_id: number; name: string }[];
  defaultPreset?: string;
  profiles?: Record<number, unknown>;
}

interface Write {
  state?: unknown;
  games?: { app_id: number; name: string }[];
  defaultPreset?: string;
  profile?: { appId: number; value: unknown };
}

let base: Omit<PanelCache, "profiles"> = {};
let profiles = new Map<number, unknown>();

export function readCache(): PanelCache {
  const out: PanelCache = { ...base };
  if (profiles.size > 0) out.profiles = Object.fromEntries(profiles);
  return out;
}

export function writeCache(update: Write): void {
  const { profile, ...rest } = update;
  base = { ...base, ...rest };
  if (profile) {
    profiles.delete(profile.appId);
    profiles.set(profile.appId, profile.value);
    while (profiles.size > MAX_PROFILES) {
      const oldest = profiles.keys().next().value as number;
      profiles.delete(oldest);
    }
  }
}

export function clearCache(): void {
  base = {};
  profiles = new Map();
}
