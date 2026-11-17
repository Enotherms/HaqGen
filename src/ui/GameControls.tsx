import { PanelSectionRow, SliderField, ToggleField } from "@decky/ui";
import { ProfileInfo, Settings } from "../api";
import { frameLimitTip, PRESET_LABELS, PRESET_ORDER, RESTART, summaryLine } from "../logic";

interface Props {
  profile: ProfileInfo;
  onToggle: (on: boolean) => void;
  onChange: (s: Settings) => void;
}

export function GameControls({ profile, onToggle, onChange }: Props) {
  const presetIndex = profile.preset ? PRESET_ORDER.indexOf(profile.preset as never) : 1;
  return (
    <>
      <PanelSectionRow>
        <ToggleField
          label="Frame generation"
          description={profile.exists ? summaryLine(profile) : RESTART.game}
          checked={profile.exists}
          onChange={onToggle}
        />
      </PanelSectionRow>
      {profile.exists && (
        <>
          <PanelSectionRow>
            <SliderField
              label="Preset"
              description={
                profile.preset ? RESTART.instant : `Custom (changed in Advanced). ${RESTART.instant}`
              }
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
