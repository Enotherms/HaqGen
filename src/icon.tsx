import { ICON_PATHS } from "./iconPaths";

export function HaqGenIcon({ size = "1em" }: { size?: string | number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
