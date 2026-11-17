import { DialogButton, Focusable, PanelSectionRow } from "@decky/ui";
import { CSSProperties, ReactNode } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";

export const ACCENT = "#e3a44a";
export const DANGER = "#d0505a";

const buttonBase: CSSProperties = { width: "100%", minWidth: 0, borderRadius: 4 };
const rowGap: CSSProperties = { padding: "3px 0", width: "100%" };

export function SectionHeader({ title }: { title: string }) {
  return (
    <PanelSectionRow>
      <div style={{ width: "100%", textAlign: "center", marginTop: 16, marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.3, color: "#ffffff" }}>{title}</div>
        <div style={{ height: 3, borderRadius: 2, background: ACCENT, marginTop: 6, opacity: 0.85 }} />
      </div>
    </PanelSectionRow>
  );
}

export function PrimaryButton(props: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <PanelSectionRow>
      <div style={rowGap}>
      <DialogButton
        disabled={props.disabled}
        onClick={props.onClick}
        style={{
          ...buttonBase,
          background: "linear-gradient(135deg, rgba(227,164,74,0.32), rgba(227,164,74,0.14))",
          border: `1px solid ${ACCENT}88`,
          opacity: props.disabled ? 0.5 : 1,
        }}
      >
        {props.children}
      </DialogButton>
      </div>
    </PanelSectionRow>
  );
}

export function PlainButton(props: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <PanelSectionRow>
      <div style={rowGap}>
        <DialogButton disabled={props.disabled} onClick={props.onClick} style={{ ...buttonBase, opacity: props.disabled ? 0.5 : 1 }}>
          {props.children}
        </DialogButton>
      </div>
    </PanelSectionRow>
  );
}

export function DangerButton(props: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <PanelSectionRow>
      <div style={rowGap}>
      <DialogButton
        disabled={props.disabled}
        onClick={props.onClick}
        style={{
          ...buttonBase,
          background: "rgba(208,80,90,0.16)",
          border: `1px solid ${DANGER}99`,
          opacity: props.disabled ? 0.5 : 1,
        }}
      >
        {props.children}
      </DialogButton>
      </div>
    </PanelSectionRow>
  );
}

export function CollapsePill({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <PanelSectionRow>
      <DialogButton
        aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
        onClick={onToggle}
        style={{ ...buttonBase, height: 26, minHeight: 26, padding: 0, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        {open ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
      </DialogButton>
    </PanelSectionRow>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return (
    <PanelSectionRow>
      <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.35 }}>{children}</div>
    </PanelSectionRow>
  );
}

export function SegmentedChoice<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <PanelSectionRow>
      <div style={{ width: "100%", padding: "6px 0" }}>
        <div style={{ fontSize: 15, marginBottom: 6 }}>{label}</div>
        <Focusable flow-children="horizontal" style={{ display: "flex", gap: 6 }}>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <DialogButton
                key={o.value}
                onClick={() => onChange(o.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "0 4px",
                  height: 36,
                  minHeight: 36,
                  fontSize: 13,
                  borderRadius: 4,
                  background: active ? "rgba(227,164,74,0.38)" : undefined,
                  border: active ? `1px solid ${ACCENT}` : "1px solid transparent",
                }}
              >
                {o.label}
              </DialogButton>
            );
          })}
        </Focusable>
        {description && <div style={{ fontSize: 12, opacity: 0.72, marginTop: 6 }}>{description}</div>}
      </div>
    </PanelSectionRow>
  );
}
