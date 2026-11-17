import { PanelSectionRow, SliderField, ToggleField } from "@decky/ui";
import { ProfileInfo, Settings } from "../api";
import { S } from "../strings";
import { useInfo } from "./info";
import { Hint } from "./theme";

export function Advanced({
  profile,
  onChange,
  gamescope,
  onGamescope,
}: {
  profile: ProfileInfo;
  onChange: (s: Settings) => void;
  gamescope: boolean;
  onGamescope: (on: boolean) => void;
}) {
  const flowInfo = useInfo(S.flowScaleInfo);
  const perfInfo = useInfo(S.perfModelInfo);
  return (
    <>
      <Hint>{S.advancedHint}</Hint>
      <PanelSectionRow>
        <SliderField
          label={S.flowScale}
          description={flowInfo}
          value={profile.flow_scale}
          min={0.25}
          max={1}
          step={0.05}
          showValue
          onChange={(v) => onChange({ flow_scale: Math.round(v * 100) / 100 })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField label={S.gamescope} description={S.gamescopeNote} checked={gamescope} onChange={onGamescope} />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          label={S.perfModel}
          description={perfInfo}
          checked={profile.performance_mode}
          onChange={(v) => onChange({ performance_mode: v })}
        />
      </PanelSectionRow>
    </>
  );
}
