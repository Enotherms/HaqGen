import { Field, PanelSectionRow, SliderField } from "@decky/ui";
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
import { Hint, PlainButton, PrimaryButton, SectionHeader } from "./theme";

interface Props {
  scope: ScopeResult;
  onMultiplier: (position: number) => void;
  onChange: (s: Settings) => void;
  onSaveForGame: () => void;
  onUseDefault: () => void;
}

export function NowPlaying({ scope, onMultiplier, onChange, onSaveForGame, onUseDefault }: Props) {
  const p = scope.profile;
  const presetIndex = p.preset ? PRESET_ORDER.indexOf(p.preset as never) : 1;
  const frameGenInfo = useInfo(S.frameGenInfo);
  const presetInfo = useInfo(p.preset ? `${RESTART.instant}.` : `${S.presetCustom} ${RESTART.instant}.`);
  const saveInfo = useInfo(S.saveForGameInfo);
  const defaultInfo = useInfo(S.useDefaultInfo);
  return (
    <>
      <SectionHeader title={S.nowPlaying} />
      <PanelSectionRow>
        <Field
          label={scopeTitle(scope)}
          description={`${scopeLine(scope)}${scope.enabled ? ` · ${summaryLine(p)}` : " · Off"}`}
          bottomSeparator="none"
        />
      </PanelSectionRow>
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
          <PanelSectionRow>
            <SliderField
              label={S.preset}
              description={presetInfo}
              value={presetIndex}
              min={0}
              max={2}
              step={1}
              notchCount={3}
              notchTicksVisible
              notchLabels={PRESET_ORDER.map((key, i) => ({ notchIndex: i, label: PRESET_LABELS[key] }))}
              onChange={(i) => onChange({ preset: PRESET_ORDER[i] })}
            />
          </PanelSectionRow>
          <Hint>{frameLimitTip(p.multiplier)}</Hint>
        </>
      )}
      {scope.game && scope.scope === "default" && (
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
