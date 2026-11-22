import { PanelSectionRow, SliderField, ToggleField } from "@decky/ui";
import { ProfileInfo, Settings } from "../api";
import { S } from "../strings";
import { useInfo } from "./info";
import { Desc, Hint } from "./theme";

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
  const hint = useInfo(S.advancedHint);
  return (
    <>
      {hint && <Hint>{hint}</Hint>}
      <PanelSectionRow>
        <SliderField
          label={S.flowScale}
          description={S.flowScaleInfo}
          value={profile.flow_scale}
          min={0.25}
          max={1}
          step={0.05}
          showValue
          onChange={(v) => onChange({ flow_scale: Math.round(v * 100) / 100 })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField label={S.gamescope} description={Desc({ text: S.gamescopeNote, restart: S.restartGame })} checked={gamescope} onChange={onGamescope} />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          label={S.perfModel}
          description={S.perfModelInfo}
          bottomSeparator="none"
          checked={profile.performance_mode}
          onChange={(v) => onChange({ performance_mode: v })}
        />
      </PanelSectionRow>
    </>
  );
}
