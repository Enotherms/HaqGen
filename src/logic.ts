export const PRESET_LABELS: Record<string, string> = {
  battery: "Battery",
  balanced: "Balanced",
  quality: "Quality",
};

const ERROR_TEXT: Record<string, string> = {
  dll_not_found:
    "Lossless Scaling was not found. Install it from Steam on this Deck, then try again.",
  install_url_unknown:
    "Automatic install is not available yet in this version. Install lsfg-vk manually, then press Set up again.",
  install_failed: "Installing lsfg-vk failed. Open the log for details.",
  not_confirmed: "Please confirm before removing data.",
  flatpak_install_failed: "Could not install lsfg-vk for Flatpak. Check the internet connection and Flathub.",
  flatpak_runtime_unsupported: "This app's Flatpak runtime is not supported by lsfg-vk yet.",
  flatpak_app_not_found: "That Flatpak app was not found. It may have been uninstalled.",
  not_running: "Start the game first, then press Detect.",
  game_not_found: "This game's install folder was not found.",
};

export function describeError(err: unknown, detail?: string): string {
  if (typeof err === "string") {
    const text = ERROR_TEXT[err] ?? err;
    return detail ? `${text} (${detail})` : text;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Open the log for details.";
}

export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  cancel(): void;
  flush(): void;
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: A | undefined;
  const run = () => {
    const args = pending;
    timer = undefined;
    pending = undefined;
    if (args) fn(...args);
  };
  const wrapped = ((...args: A) => {
    if (timer !== undefined) clearTimeout(timer);
    pending = args;
    timer = setTimeout(run, ms);
  }) as Debounced<A>;
  wrapped.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  };
  wrapped.flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    run();
  };
  return wrapped;
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

export function settingsEqual(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}


export const RESTART = {
  instant: "Applies instantly",
  game: "Restart the game to apply",
  none: "No restart needed",
  setup: "Restart running games to apply",
  remove: "Restart running games to fully stop",
} as const;

export const PRESET_ORDER = ["battery", "balanced", "quality"] as const;

export function frameLimitTip(multiplier: number, refreshHz = 90): string {
  return `Tip: cap the game at ${Math.floor(refreshHz / multiplier)} FPS for ${multiplier}x on ${refreshHz} Hz.`;
}

export const FPS_CAPS = [0, 30, 40, 45, 60] as const;

export function summaryLine(p: {
  multiplier: number;
  preset: string | null;
  performance_mode: boolean;
}): string {
  const preset = p.preset ? PRESET_LABELS[p.preset] ?? p.preset : "Custom";
  const model = p.performance_mode ? "Performance model" : "Standard model";
  return `${p.multiplier}x · ${preset} · ${model}`;
}

export function restartBanner(gameName: string): string {
  return `Restart ${gameName} to apply your changes.`;
}

export const SLIDER_LABELS = ["Off", "2x", "3x", "4x"] as const;

export function multiplierToPosition(exists: boolean, multiplier: number): number {
  if (!exists) return 0;
  return Math.max(1, Math.min(3, Math.round(multiplier) - 1));
}

export function engineMultiplier(multiplier: number): number {
  if (!Number.isFinite(multiplier)) return 2;
  return Math.max(2, Math.min(4, Math.round(multiplier)));
}

export function showEngineChoice(scope: { enabled: boolean; haqengine_installed: boolean; engine: "lsfg" | "haqengine" }): boolean {
  return scope.enabled && (scope.haqengine_installed || scope.engine === "haqengine");
}

export function positionToMultiplier(position: number): number | null {
  if (position <= 0) return null;
  return Math.min(4, Math.round(position) + 1);
}

export interface ScopeInfo {
  scope: "default" | "game";
  game: string | null;
  running: boolean;
}

export function scopeTitle(s: ScopeInfo): string {
  return s.game ?? "Default profile";
}

export function scopeLine(s: ScopeInfo): string {
  if (!s.game) return "Used by games without their own profile";
  if (!s.running) return "Saved profile · applies when the game starts";
  return s.scope === "game" ? "Running · has its own profile" : "Running · uses the Default profile";
}

export interface EditTarget {
  appId: number | null;
  game: string | null;
  locked: boolean;
}

export function editTarget(
  running: { appId: number; name: string } | null,
  picked: { app_id: number | null; game: string | null } | null
): EditTarget {
  if (running) return { appId: running.appId, game: running.name, locked: true };
  if (picked && picked.app_id !== null) return { appId: picked.app_id, game: picked.game, locked: false };
  return { appId: null, game: null, locked: false };
}

export function creatableGames(
  games: { app_id: number; name: string }[],
  profiles: { app_id: number | null }[]
): { app_id: number; name: string }[] {
  const taken = new Set(profiles.map((p) => p.app_id));
  return games.filter((g) => !taken.has(g.app_id));
}

export interface LsBranch {
  installed: boolean;
  selected: string | null;
  current: string | null;
}

const TARGET_BRANCH = "lsfg-vk";

export function branchMessage(b: LsBranch, dllFound: boolean): { ok: boolean; text: string } {
  if (dllFound && (!b.installed || b.current === TARGET_BRANCH)) {
    return { ok: true, text: `Lossless Scaling found (${TARGET_BRANCH} branch)` };
  }
  if (!b.installed) return { ok: false, text: "Lossless Scaling not found. Install it from Steam." };
  if (b.selected === TARGET_BRANCH) {
    return { ok: false, text: "Lossless Scaling is switching to the lsfg-vk branch. Let Steam finish downloading it." };
  }
  return {
    ok: false,
    text: "Switch Lossless Scaling to the lsfg-vk beta branch: Library › Lossless Scaling › Properties › Betas › lsfg-vk.",
  };
}

const LAYER_NAMES: Record<string, string> = { VkLayer_MAKO_render: "MAKO" };

export function layersWarning(layers: string[]): string | null {
  if (layers.length === 0) return null;
  const names = layers.map((l) => LAYER_NAMES[l] ?? l.replace(/^VkLayer_/, ""));
  return names.length === 1
    ? `${names[0]} layer found. It may interfere.`
    : `${names.join(", ")} layers found. They may interfere.`;
}
