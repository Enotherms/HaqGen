import { PanelSection, PanelSectionRow } from "@decky/ui";
import { definePlugin } from "@decky/api";
import { FaFilm } from "react-icons/fa";

function Content() {
  return (
    <PanelSection title="HaqGen">
      <PanelSectionRow>Setup is coming soon.</PanelSectionRow>
    </PanelSection>
  );
}

export default definePlugin(() => ({
  name: "HaqGen",
  titleView: <div>HaqGen</div>,
  content: <Content />,
  icon: <FaFilm />,
  onDismount() {},
}));
