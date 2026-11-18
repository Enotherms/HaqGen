import { S } from "../strings";
import { Hint, PrimaryButton } from "./theme";

export function LaunchSection({ onCopy }: { onCopy: () => void }) {
  return (
    <>
      <PrimaryButton onClick={onCopy}>{S.copyLaunch}</PrimaryButton>
      <Hint>{S.launchHow}</Hint>
    </>
  );
}
