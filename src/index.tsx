import { definePlugin } from "@decky/api";
import { FaFilm } from "react-icons/fa";
import { Panel } from "./ui/Panel";

export default definePlugin(() => ({
  name: "HaqGen",
  titleView: <div>HaqGen</div>,
  content: <Panel />,
  icon: <FaFilm />,
  onDismount() {},
}));
