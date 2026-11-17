import { Field, PanelSectionRow, SliderField } from "@decky/ui";
import { ReactNode } from "react";
import { ScopeResult, Settings } from "../api";
import {
  frameLimitTip,
  multiplierToPosition,
  PRESET_LABELS,
  PRESET_ORDER,
  RESTART,
  scopeLine,
  scopeTitle,
  SLIDER_LABELS,
  summaryLine,
} from "../logic";
import { S } from "../strings";
import { useInfo } from "./info";
import { Hint, PlainButton, PrimaryButton, SectionHeader, SegmentedChoice } from "./theme";

interface Props {
  scope: ScopeResult;
  running: boolean;
  saved: boolean;
  picker: ReactNode;
  onMultiplier: (position: number) => void;
  onChange: (s: Settings) => void;
  onSaveForGame: () => void;
  onUseDefault: () => void;
}

export function NowPlaying({ scope, running, saved, picker, onMultiplier, onChange, onSaveForGame, onUseDefault }: Props) {
  const p = scope.profile;
  const frameGenInfo = useInfo(S.frameGenInfo);
  const presetInfo = useInfo(p.preset ? `${RESTART.instant}.` : `${S.presetCustom} ${RESTART.instant}.`);
  const saveInfo = useInfo(S.saveForGameInfo);
  const defaultInfo = useInfo(S.useDefaultInfo);
  return (
    <>
      <SectionHeader title={running ? S.nowPlaying : S.profileSection} />
      {picker}
      <PanelSectionRow>
        <Field
          label={scopeTitle({ ...scope, running })}
          description={`${scopeLine({ ...scope, running })}${scope.enabled ? ` · ${summaryLine(p)}` : " · Off"}`}
          bottomSeparator="none"
        />
      </PanelSectionRow>
      <Hint>{saved ? <span style={{ color: "#8fd694", fontWeight: 600 }}>{S.saved}</span> : S.autoSave}</Hint>
      <PanelSectionRow>
        <SliderField
          label={S.frameGen}
          description={frameGenInfo}
          value={multiplierToPosition(scope.enabled, p.multiplier)}
          min={0}
          max={3}
          step={1}
          notchCount={4}
          notchTicksVisible
          notchLabels={SLIDER_LABELS.map((label, i) => ({ notchIndex: i, label }))}
          onChange={onMultiplier}
        />
      </PanelSectionRow>
      {scope.enabled && (
        <>
          <SegmentedChoice
            label={S.preset}
            description={presetInfo}
            options={PRESET_ORDER.map((key) => ({ value: key, label: PRESET_LABELS[key] }))}
            value={(p.preset as (typeof PRESET_ORDER)[number] | null) ?? null}
            onChange={(key) => onChange({ preset: key })}
          />
          <Hint>{frameLimitTip(p.multiplier)}</Hint>
          <Hint>{S.overlayNote}</Hint>
        </>
      )}
      {running && scope.game && scope.scope === "default" && (
        <>
          <PrimaryButton onClick={onSaveForGame}>{S.saveForGame(scope.game)}</PrimaryButton>
          {saveInfo && <Hint>{saveInfo}</Hint>}
        </>
      )}
      {scope.game && scope.scope === "game" && (
        <>
          <PlainButton onClick={onUseDefault}>{S.useDefault}</PlainButton>
          {defaultInfo && <Hint>{defaultInfo}</Hint>}
        </>
      )}
    </>
  );
}
