import { ButtonItem, PanelSectionRow, SliderField, TextField, ToggleField } from "@decky/ui";
import { useEffect, useState } from "react";
import { ProfileInfo, Settings } from "../api";
import { RESTART } from "../logic";

interface Props {
  profile: ProfileInfo;
  gameRunning: boolean;
  onChange: (s: Settings) => void;
  onProcessNames: (names: string[]) => void;
  onDetect: () => Promise<void>;
  onCopyLaunchOption: () => void;
}

export function Advanced({
  profile,
  gameRunning,
  onChange,
  onProcessNames,
  onDetect,
  onCopyLaunchOption,
}: Props) {
  const [exes, setExes] = useState(profile.exe_names.join(", "));
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    setExes(profile.exe_names.join(", "));
  }, [profile.name, profile.exe_names.join(",")]);

  return (
    <>
      <PanelSectionRow>
        <SliderField
          label="Multiplier"
          description={RESTART.instant}
          value={profile.multiplier}
          min={2}
          max={4}
          step={1}
          notchCount={3}
          notchTicksVisible
          notchLabels={[
            { notchIndex: 0, label: "2x" },
            { notchIndex: 1, label: "3x" },
            { notchIndex: 2, label: "4x" },
          ]}
          onChange={(v) => onChange({ multiplier: v })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <SliderField
          label="Flow scale"
          description={`Lower is faster, higher looks better. ${RESTART.instant}`}
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
          description={`Lighter model, uses less GPU. ${RESTART.instant}`}
          checked={profile.performance_mode}
          onChange={(v) => onChange({ performance_mode: v })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <TextField
          label="Game process names"
          description={`Turns the profile on automatically. ${RESTART.game}`}
          value={exes}
          onChange={(e) => setExes(e.target.value)}
          onBlur={() => onProcessNames(exes.split(",").map((s) => s.trim()).filter(Boolean))}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          disabled={!gameRunning || detecting}
          description={gameRunning ? "Finds the running game's .exe" : "Start the game to use Detect"}
          onClick={async () => {
            setDetecting(true);
            try {
              await onDetect();
            } finally {
              setDetecting(false);
            }
          }}
        >
          {detecting ? "Detecting..." : "Detect process name"}
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          description={`Only needed if it does not turn on by itself. ${RESTART.game}`}
          onClick={onCopyLaunchOption}
        >
          Copy launch option
        </ButtonItem>
      </PanelSectionRow>
    </>
  );
}
