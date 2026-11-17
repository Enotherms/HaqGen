import { Field, PanelSectionRow, SliderField } from "@decky/ui";
import { ProfileInfo, Settings } from "../api";
import {
  frameLimitTip,
  headerLine,
  multiplierToPosition,
  PRESET_LABELS,
  PRESET_ORDER,
  RESTART,
  SLIDER_LABELS,
} from "../logic";
import { S } from "../strings";

interface Props {
  gameName: string;
  running: boolean;
  profile: ProfileInfo;
  onMultiplier: (position: number) => void;
  onChange: (s: Settings) => void;
}

export function GameControls({ gameName, running, profile, onMultiplier, onChange }: Props) {
  const presetIndex = profile.preset ? PRESET_ORDER.indexOf(profile.preset as never) : 1;
  return (
    <>
      <PanelSectionRow>
        <Field label={gameName} description={headerLine(running, profile)} bottomSeparator="standard" />
      </PanelSectionRow>
      <PanelSectionRow>
        <SliderField
          label={S.frameGen}
          description={S.frameGenNote}
          value={multiplierToPosition(profile.exists, profile.multiplier)}
          min={0}
          max={3}
          step={1}
          notchCount={4}
          notchTicksVisible
          notchLabels={SLIDER_LABELS.map((label, i) => ({ notchIndex: i, label }))}
          onChange={onMultiplier}
        />
      </PanelSectionRow>
      {profile.exists && (
        <>
          <PanelSectionRow>
            <SliderField
              label={S.preset}
              description={profile.preset ? RESTART.instant : `${S.presetCustom} ${RESTART.instant}`}
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
          <PanelSectionRow>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{frameLimitTip(profile.multiplier)}</div>
          </PanelSectionRow>
        </>
      )}
    </>
  );
}
