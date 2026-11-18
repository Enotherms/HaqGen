export const C = {
  bg: "#0e141b",
  surface: "#32373d",
  accent: "#1769b8",
  accentFocus: "#1a9fff",
  onAccent: "#ffffff",
  onAccentFocus: "#0e141b",
  warning: "#f2b84b",
  danger: "#ff7a7a",
  onDanger: "#1b0507",
  success: "#7fd18b",
  text: "#ffffff",
  hint: "#b6b9bc",
} as const;

function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const lin = ch.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const PAIRS: [string, string, string, number][] = [
  ["main button text", C.onAccent, C.accent, 4.5],
  ["focused main button text", C.onAccentFocus, C.accentFocus, 4.5],
  ["warning text", C.warning, C.bg, 4.5],
  ["danger text on background", C.danger, C.bg, 4.5],
  ["danger text on button", C.danger, C.surface, 4.5],
  ["focused danger button text", C.onDanger, C.danger, 4.5],
  ["success text", C.success, C.bg, 4.5],
  ["hint text", C.hint, C.bg, 4.5],
  ["body text on button", C.text, C.surface, 4.5],
  ["focus outline vs button", C.accentFocus, C.surface, 3],
];
