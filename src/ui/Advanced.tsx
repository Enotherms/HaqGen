import { ButtonItem, PanelSectionRow, SliderField, TextField, ToggleField } from "@decky/ui";
import { useEffect, useState } from "react";
import { ProfileInfo, Settings } from "../api";
import { RESTART } from "../logic";
import { S } from "../strings";

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
          label={S.flowScale}
          description={`${S.flowScaleNote} ${RESTART.instant}`}
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
          label={S.perfModel}
          description={`${S.perfModelNote} ${RESTART.instant}`}
          checked={profile.performance_mode}
          onChange={(v) => onChange({ performance_mode: v })}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <TextField
          label={S.processNames}
          description={`${S.processNamesNote} ${RESTART.game}`}
          value={exes}
          onChange={(e) => setExes(e.target.value)}
          onBlur={() => onProcessNames(exes.split(",").map((s) => s.trim()).filter(Boolean))}
        />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          disabled={!gameRunning || detecting}
          description={gameRunning ? S.detectRunning : S.detectStart}
          onClick={async () => {
            setDetecting(true);
            try {
              await onDetect();
            } finally {
              setDetecting(false);
            }
          }}
        >
          {detecting ? S.detecting : S.detect}
        </ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          description={`${S.copyLaunchNote} ${RESTART.game}`}
          onClick={onCopyLaunchOption}
        >
          {S.copyLaunch}
        </ButtonItem>
      </PanelSectionRow>
    </>
  );
}
