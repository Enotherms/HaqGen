import { S } from "../strings";
import { Hint, PrimaryButton, SectionHeader } from "./theme";

export function LaunchSection({ onCopy }: { onCopy: () => void }) {
  return (
    <>
      <SectionHeader title={S.launchTitle} />
      <PrimaryButton onClick={onCopy}>{S.copyLaunch}</PrimaryButton>
      <Hint>{S.launchHow}</Hint>
    </>
  );
}
