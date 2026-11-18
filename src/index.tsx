import { definePlugin } from "@decky/api";
import { HaqGenIcon } from "./icon";
import { Panel } from "./ui/Panel";

export default definePlugin(() => ({
  name: "HaqGen",
  titleView: <div>HaqGen</div>,
  content: <Panel />,
  icon: <HaqGenIcon />,
  onDismount() {},
}));
