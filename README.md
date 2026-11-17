# HaqGen

A Decky Loader plugin for the Steam Deck that makes Lossless Scaling frame generation easier to set up and use.

Author: [Enotherms](https://github.com/Enotherms)

> **Status: in development.** Nothing here is released yet. This README describes what HaqGen is being built to do, and the sections marked "planned" are not available yet.

## What it does (planned)

- One-click setup. HaqGen finds your Lossless Scaling `Lossless.dll`, installs lsfg-vk and writes its config.
- Simple mode: an on/off toggle and three presets (Battery, Balanced, Quality).
- Advanced mode: every lsfg-vk option, including a picker for the LSFG model version.
- Per-game profiles, saved by Steam app id.
- A button to copy the launch option for the current game.
- A button to remove the data HaqGen installed. It only deletes files HaqGen created and never touches drivers, system files, your games or your Lossless Scaling install.
- A log viewer and a reset-to-defaults button.

## Requirements

- Steam Deck (developed on the OLED model) running SteamOS
- [Decky Loader](https://decky.xyz) installed
- A copy of [Lossless Scaling](https://store.steampowered.com/app/993090/Lossless_Scaling/) bought on Steam and installed on the Deck. HaqGen does not include or copy it.

HaqGen is an independent community project. It is not made or supported by the authors of Lossless Scaling or lsfg-vk.

## Install (planned)

1. Install Decky Loader on your Deck.
2. Install Lossless Scaling from Steam.
3. Install HaqGen (store listing or manual install, to be documented at release).
4. Open the Quick Access menu, go to the Decky tab and open HaqGen.
5. Press "Set up". HaqGen locates the DLL and installs lsfg-vk.

## Usage (planned)

1. Start a game, or pick one in the HaqGen panel.
2. Turn frame generation on and choose a preset.
3. Open Advanced if you want to change the model version, multiplier, flow scale or performance mode.
4. If you prefer to set launch options yourself, press "Copy launch option" and paste it into the game's launch options in Steam.

Tip: frame generation costs GPU time. If a game is already GPU-bound on the Deck, it can lower your real frame rate, so try a lighter preset or the performance mode.

## Removing HaqGen's data (planned)

Use "Remove plugin data" in the panel. It lists exactly what will be deleted and asks you to confirm. Launch options you set in Steam are not edited, so clear them yourself afterwards.

## Development

Stack: TypeScript and React for the panel, Python for the backend. Develop on a computer and deploy to the Deck over SSH (enable SSH in Desktop Mode first). Setup steps will be added once the project is scaffolded from the official Decky plugin template.

Design notes are in [`docs/design.md`](docs/design.md).

## License

To be decided before the first release.
