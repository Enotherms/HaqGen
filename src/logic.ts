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
