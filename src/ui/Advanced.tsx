import {
  ButtonItem,
  PanelSectionRow,
  SliderField,
  TextField,
  ToggleField,
} from "@decky/ui";
import { useEffect, useState } from "react";
import { ProfileInfo, Settings } from "../api";

interface Props {
  profile: ProfileInfo;
  dllPath: string | null;
  onChange: (s: Settings) => void;
  onShowLog: () => void;
  onReset: () => void;
}

export function Advanced({ profile, dllPath, onChange, onShowLog, onReset }: Props) {
  const [exes, setExes] = useState(profile.exe_names.join(", "));

  useEffect(() => {
    setExes(profile.exe_names.join(", "));
  }, [profile.name]);

  return (
    <>
      <PanelSectionRow>
        <SliderField
          label="Multiplier"
          value={profile.multiplier}
          min={2}
          max={4}
          step={1}
          showValue
          valueSuffix="x"
          onChange={(v) => onChange({ multiplier: v })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <SliderField
          label="Flow scale"
          value={profile.flow_scale}
          min={0.25}
          max={1}
          step={0.05}
          showValue
          onChange={(v) => onChange({ flow_scale: Math.round(v * 100) / 100 })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ToggleField
          label="Performance model"
          description="Lighter frame generation model. Standard is used when off."
          checked={profile.performance_mode}
          onChange={(v) => onChange({ performance_mode: v })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <TextField
          label="Game process names"
          description="Comma separated, for example game.exe"
          value={exes}
          onChange={(e) => setExes(e.target.value)}
          onBlur={() =>
            onChange({
              exe_names: exes.split(",").map((s) => s.trim()).filter(Boolean),
            })
          }
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <div style={{ fontSize: 12, opacity: 0.7, wordBreak: "break-all" }}>
          DLL: {dllPath ?? "not found"}
        </div>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={onShowLog}>
          Show log
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" onClick={onReset}>
          Reset to defaults
        </ButtonItem>
      </PanelSectionRow>
    </>
  );
}
