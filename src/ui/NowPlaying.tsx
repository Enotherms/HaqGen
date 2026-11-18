import { ConfirmModal, Field, PanelSectionRow, showModal, SliderField } from "@decky/ui";
import { ReactNode } from "react";
import { ScopeResult, Settings } from "../api";
import {
  FPS_CAPS,
  frameLimitTip,
  multiplierToPosition,
  PRESET_LABELS,
  PRESET_ORDER,
  scopeLine,
  scopeTitle,
  SLIDER_LABELS,
  summaryLine,
} from "../logic";
import { S } from "../strings";
import { useInfo } from "./info";
import { Hint, PlainButton, PrimaryButton, SegmentedChoice } from "./theme";

interface Props {
  scope: ScopeResult;
  running: boolean;
  saved: boolean;
  picker: ReactNode;
  onMultiplier: (position: number) => void;
  onChange: (s: Settings) => void;
  onFpsCap: (cap: number) => void;
  onSaveForGame: () => void;
  onUseDefault: () => void;
}

export function NowPlaying(props: Props) {
  const { scope, running, saved, picker, onMultiplier, onChange, onFpsCap, onSaveForGame, onUseDefault } = props;
  const p = scope.profile;
  const info = {
    frameGen: useInfo(S.frameGenInfo),
    preset: useInfo(S.presetInfo),
    fpsCap: useInfo(S.fpsCapInfo),
    save: useInfo(S.saveForGameInfo),
    del: useInfo(S.useDefaultInfo),
    tip: useInfo(frameLimitTip(p.multiplier)),
    overlay: useInfo(S.overlayNote),
  };
  const summary = `${scope.enabled ? summaryLine(p) : "Off"}${saved ? `  ${S.saved}` : ""}`;
  return (
    <>
      {running ? (
        <PanelSectionRow>
          <Field label={scopeTitle({ ...scope, running })} description={`${scopeLine({ ...scope, running })} · ${summary}`} bottomSeparator="none" />
        </PanelSectionRow>
      ) : (
        <>
          {picker}
          <Hint>{summary}</Hint>
        </>
      )}
      <PanelSectionRow>
        <SliderField
          label={S.frameGen}
          description={info.frameGen}
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
        <SegmentedChoice
          label={S.preset}
          description={p.preset ? info.preset : S.presetCustom}
          options={PRESET_ORDER.map((key) => ({ value: key, label: PRESET_LABELS[key] }))}
          value={(p.preset as (typeof PRESET_ORDER)[number] | null) ?? null}
          onChange={(key) => onChange({ preset: key })}
        />
      )}
      <SegmentedChoice
        label={S.fpsCap}
        description={info.fpsCap}
        options={FPS_CAPS.map((cap) => ({ value: String(cap), label: cap === 0 ? "Off" : String(cap) }))}
        value={String(scope.fps_cap ?? 0)}
        onChange={(v) => onFpsCap(Number(v))}
      />
      {scope.enabled && info.tip && <Hint>{info.tip}</Hint>}
      {scope.enabled && info.overlay && <Hint>{info.overlay}</Hint>}
      {running && scope.game && scope.scope === "default" && (
        <>
          <PrimaryButton onClick={onSaveForGame}>{S.saveForGame(scope.game)}</PrimaryButton>
          {info.save && <Hint>{info.save}</Hint>}
        </>
      )}
      {scope.game && scope.scope === "game" && (
        <>
          <PlainButton
            onClick={() =>
              showModal(
                <ConfirmModal
                  strTitle={S.deleteConfirmTitle}
                  strOKButtonText={S.deleteConfirmOk}
                  strCancelButtonText={S.cancel}
                  onOK={onUseDefault}
                >
                  {S.deleteConfirmBody(scope.game ?? "")}
                </ConfirmModal>
              )
            }
          >
            {S.useDefault}
          </PlainButton>
          {info.del && <Hint>{info.del}</Hint>}
        </>
      )}
    </>
  );
}
