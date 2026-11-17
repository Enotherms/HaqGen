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
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wrapped = ((...args: A) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, ms);
  }) as Debounced<A>;
  wrapped.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
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

export interface GameEntry {
  app_id: number;
  name: string;
}

export interface GameOption {
  data: number;
  label: string;
}

export interface GameGroup {
  label: string;
  options: GameOption[];
}

export function buildGameOptions(
  games: GameEntry[],
  running: { appId: number; name: string } | null
): GameGroup[] {
  const groups: GameGroup[] = [];
  if (running) groups.push({ label: "Running", options: [{ data: running.appId, label: running.name }] });
  const installed = games
    .filter((g) => !running || g.app_id !== running.appId)
    .map((g) => ({ data: g.app_id, label: g.name }));
  if (installed.length > 0) groups.push({ label: `Installed (${installed.length})`, options: installed });
  return groups;
}

export function gameName(
  games: GameEntry[],
  running: { appId: number; name: string } | null,
  appId: number
): string | null {
  if (running && running.appId === appId) return running.name;
  return games.find((g) => g.app_id === appId)?.name ?? null;
}

export function parseStoredAppId(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
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
  const limit = Math.floor(refreshHz / multiplier);
  return `Tip: set Steam's frame limit to ${limit} for ${multiplier}x on your ${refreshHz} Hz screen.`;
}

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

export function positionToMultiplier(position: number): number | null {
  if (position <= 0) return null;
  return Math.min(4, Math.round(position) + 1);
}

export function headerLine(
  running: boolean,
  p: { exists: boolean; multiplier: number; preset: string | null; performance_mode: boolean }
): string {
  return `${running ? "Running" : "Not running"} | ${p.exists ? summaryLine(p) : "Off"}`;
}
