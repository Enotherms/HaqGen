import { DialogButton, Focusable, PanelSectionRow } from "@decky/ui";
import { CSSProperties, ReactNode } from "react";
import { FaChevronDown, FaChevronUp, FaGithub, FaInfoCircle } from "react-icons/fa";
import { C } from "../colors";

const STEP = 8;
const LABEL: CSSProperties = { fontSize: 16, color: C.text, marginBottom: STEP };
const buttonBase: CSSProperties = { width: "100%", minWidth: 0, borderRadius: 4 };
const row: CSSProperties = { padding: `${STEP / 2}px 0`, width: "100%" };

export function PrimaryButton(props: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <PanelSectionRow>
      <div style={row}>
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
      <div style={row}>
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
      <div style={row}>
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

export function Hint({ children }: { children: ReactNode }) {
  return (
    <PanelSectionRow>
      <div style={{ fontSize: 12, color: C.hint, lineHeight: 1.35, padding: `${STEP / 4}px 0` }}>{children}</div>
    </PanelSectionRow>
  );
}

export function SegmentedChoice<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
  children,
}: {
  label: string;
  description?: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  children?: ReactNode;
}) {
  return (
    <PanelSectionRow>
      <div style={{ width: "100%", padding: `${STEP}px 0` }}>
        <div style={LABEL}>{label}</div>
        <Focusable flow-children="horizontal" style={{ display: "flex", gap: STEP }}>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <DialogButton
                key={o.value}
                aria-pressed={active}
                className={active ? "haqgen-seg haqgen-seg-active" : "haqgen-seg"}
                onClick={() => onChange(o.value)}
                style={{ flex: 1, minWidth: 0, padding: "0 4px", height: 36, minHeight: 36, fontSize: 13, borderRadius: 4 }}
              >
                {o.label}
              </DialogButton>
            );
          })}
        </Focusable>
        {description && <div style={{ fontSize: 12, color: C.hint, marginTop: STEP }}>{description}</div>}
        {children}
      </div>
    </PanelSectionRow>
  );
}

/** A labelled block with one full-width action, laid out like SegmentedChoice. */
export function ActionChoice({ label, children }: { label: string; children: ReactNode }) {
  return (
    <PanelSectionRow>
      <div style={{ width: "100%", padding: `${STEP}px 0` }}>
        <div style={LABEL}>{label}</div>
        {children}
      </div>
    </PanelSectionRow>
  );
}

/** A note plus one compact action, placed inside SegmentedChoice or ActionChoice. */
export function InlineAction({ note, action, disabled, onClick }: { note: string | null; action: string; disabled?: boolean; onClick: () => void }) {
  return (
    <>
      {note && <div style={{ fontSize: 12, color: C.hint, margin: `${STEP}px 0` }}>{note}</div>}
      <DialogButton
        disabled={disabled}
        onClick={onClick}
        style={{ width: "100%", padding: "0 4px", height: 36, minHeight: 36, fontSize: 13, borderRadius: 4, opacity: disabled ? 0.5 : 1 }}
      >
        {action}
      </DialogButton>
    </>
  );
}

/** A quiet heading that splits one collapsible section into parts, with a divider above it. */
export function SubHeading({ children, danger }: { children: ReactNode; danger?: boolean }) {
  return (
    <PanelSectionRow>
      <div
        style={{
          width: "100%",
          marginTop: STEP,
          paddingTop: STEP * 1.5,
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: danger ? C.danger : C.hint,
        }}
      >
        {children}
      </div>
    </PanelSectionRow>
  );
}

/** The version and a link to the source, at the bottom of the panel. */
export function Footer({ text, linkLabel, onLink }: { text: string; linkLabel: string; onLink: () => void }) {
  return (
    <PanelSectionRow>
      <Focusable
        flow-children="horizontal"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: STEP, width: "100%", padding: `${STEP}px 0` }}
      >
        <span style={{ fontSize: 12, color: C.hint }}>{text}</span>
        <DialogButton
          onClick={onLink}
          style={{ display: "flex", alignItems: "center", gap: 6, width: "auto", minWidth: 0, height: 32, minHeight: 32, padding: "0 12px", fontSize: 13, borderRadius: 4 }}
        >
          <FaGithub aria-hidden="true" />
          {linkLabel}
        </DialogButton>
      </Focusable>
    </PanelSectionRow>
  );
}

const CSS = `
.haqgen-primary { background: ${C.accent} !important; color: ${C.onAccent} !important; }
.haqgen-primary.gpfocus, .haqgen-primary:hover { background: ${C.accentFocus} !important; color: ${C.onAccentFocus} !important; }
.haqgen-danger { color: ${C.danger} !important; }
.haqgen-danger.gpfocus, .haqgen-danger:hover { background: ${C.danger} !important; color: ${C.onDanger} !important; }
.haqgen-seg-active { background: ${C.accent} !important; color: ${C.onAccent} !important; }
.haqgen-seg-active.gpfocus { background: ${C.accentFocus} !important; color: ${C.onAccentFocus} !important; }
.haqgen-info-on { background: ${C.accent} !important; color: ${C.onAccent} !important; }
.haqgen-info-on.gpfocus { background: ${C.accentFocus} !important; color: ${C.onAccentFocus} !important; }
.haqgen-collapse-danger { color: ${C.danger} !important; }
.haqgen-collapse-danger.gpfocus { background: ${C.danger} !important; color: ${C.onDanger} !important; }
`;

export function ThemeStyle() {
  return <style>{CSS}</style>;
}

export function CollapseRow({ label, open, onToggle, danger }: { label: string; open: boolean; onToggle: () => void; danger?: boolean }) {
  return (
    <PanelSectionRow>
      <div style={{ padding: `${STEP}px 0 ${STEP / 2}px`, width: "100%" }}>
        <DialogButton
          aria-expanded={open}
          onClick={onToggle}
          className={danger ? "haqgen-collapse haqgen-collapse-danger" : "haqgen-collapse"}
          style={{
            ...buttonBase,
            height: 40,
            minHeight: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `0 ${STEP * 2}px`,
          }}
        >
          <span>{label}</span>
          {open ? <FaChevronUp size={12} aria-hidden /> : <FaChevronDown size={12} aria-hidden />}
        </DialogButton>
      </div>
    </PanelSectionRow>
  );
}

export function StatusText({ kind, children }: { kind: "success" | "warning" | "danger"; children: ReactNode }) {
  const color = kind === "success" ? C.success : kind === "warning" ? C.warning : C.danger;
  const icon = kind === "success" ? "✓" : "⚠";
  return (
    <div style={{ color, fontSize: 12, lineHeight: 1.35, fontWeight: kind === "success" ? 600 : 400 }}>
      {icon} {children}
    </div>
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: STEP, width: "100%", padding: `${STEP / 2}px 0` }}>
        <div style={{ minWidth: 0 }}>
          <StatusText kind="success">{status}</StatusText>
          {warning && <StatusText kind="warning">{warning}</StatusText>}
        </div>
        <DialogButton
          aria-pressed={infoOn}
          onClick={onInfo}
          className={infoOn ? "haqgen-info haqgen-info-on" : "haqgen-info"}
          style={{
            width: "auto",
            minWidth: 0,
            height: 30,
            minHeight: 30,
            padding: `0 ${STEP * 1.5}px`,
            fontSize: 12,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: STEP - 2,
          }}
        >
          <FaInfoCircle size={12} aria-hidden /> {infoLabel}
        </DialogButton>
      </div>
    </PanelSectionRow>
  );
}
