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
        className="haqgen-primary"
        disabled={props.disabled}
        onClick={props.onClick}
        style={{ ...buttonBase, opacity: props.disabled ? 0.5 : 1 }}
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
        className="haqgen-danger"
        disabled={props.disabled}
        onClick={props.onClick}
        style={{ ...buttonBase, opacity: props.disabled ? 0.5 : 1 }}
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
                className={active ? "haqgen-seg haqgen-seg-active" : "haqgen-seg"}
                onClick={() => onChange(o.value)}
                style={{ flex: 1, minWidth: 0, padding: "0 4px", height: 36, minHeight: 36, fontSize: 13, borderRadius: 4 }}
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

const CSS = `
.haqgen-primary { background: linear-gradient(135deg, #8a5a17, #5e3d10) !important; color: #ffffff !important; border: 1px solid ${ACCENT}aa !important; }
.haqgen-primary.gpfocus, .haqgen-primary:hover { background: ${ACCENT} !important; color: #1b1306 !important; }
.haqgen-danger { background: #4a1a1f !important; color: #ffffff !important; border: 1px solid ${DANGER}aa !important; }
.haqgen-danger.gpfocus, .haqgen-danger:hover { background: ${DANGER} !important; color: #ffffff !important; }
.haqgen-seg { border: 1px solid transparent !important; }
.haqgen-seg-active { background: #6b4713 !important; color: #ffffff !important; border-color: ${ACCENT} !important; }
.haqgen-seg-active.gpfocus { background: ${ACCENT} !important; color: #1b1306 !important; }
.haqgen-info-on { background: #6b4713 !important; color: #ffffff !important; }
.haqgen-info-on.gpfocus { background: ${ACCENT} !important; color: #1b1306 !important; }
.haqgen-collapse-danger { color: #ffb3b8 !important; }
.haqgen-collapse-danger.gpfocus { color: #1b0507 !important; }
`;

export function ThemeStyle() {
  return <style>{CSS}</style>;
}

export function CollapseRow({ label, open, onToggle, danger }: { label: string; open: boolean; onToggle: () => void; danger?: boolean }) {
  return (
    <PanelSectionRow>
      <div style={{ padding: "3px 0", width: "100%" }}>
        <DialogButton
          onClick={onToggle}
          className={danger ? "haqgen-collapse haqgen-collapse-danger" : "haqgen-collapse"}
          style={{ ...buttonBase, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px" }}
        >
          <span>{label}</span>
          {open ? <FaChevronUp size={12} aria-hidden /> : <FaChevronDown size={12} aria-hidden />}
        </DialogButton>
      </div>
    </PanelSectionRow>
  );
}

export function TopBar({
  status,
  warning,
  infoOn,
  onInfo,
  infoLabel,
}: {
  status: string;
  warning: string | null;
  infoOn: boolean;
  onInfo: () => void;
  infoLabel: string;
}) {
  return (
    <PanelSectionRow>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%" }}>
        <div style={{ fontSize: 12, lineHeight: 1.3, minWidth: 0 }}>
          <span style={{ color: "#8fd694", fontWeight: 600 }}>✓ {status}</span>
          {warning && <div style={{ color: ACCENT }}>⚠ {warning}</div>}
        </div>
        <DialogButton
          aria-pressed={infoOn}
          onClick={onInfo}
          className={infoOn ? "haqgen-info haqgen-info-on" : "haqgen-info"}
          style={{ width: "auto", minWidth: 0, height: 28, minHeight: 28, padding: "0 10px", fontSize: 12, flexShrink: 0 }}
        >
          ⓘ {infoLabel}
        </DialogButton>
      </div>
    </PanelSectionRow>
  );
}
