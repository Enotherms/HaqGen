# HaqGen

A Decky Loader plugin for the Steam Deck that makes Lossless Scaling frame generation (through [lsfg-vk](https://lsfg-vk.dev)) easy to set up and control from the Quick Access menu.

Author: [Enotherms](https://github.com/Enotherms)

> **Status: early, working.** Tested on a Steam Deck OLED with Monster Hunter Wilds (about 30 FPS → 55 FPS at 2x, 70 FPS at 3x). Not in the Decky store yet; install it manually (see [Development](#development)).

HaqGen is an independent community project. It is not made or supported by the authors of Lossless Scaling, lsfg-vk or Decky Loader, and it does not include or copy Lossless Scaling.

## Features

- **One-press setup.** Installs lsfg-vk 2.0.0 (download checked against a pinned checksum), finds your Lossless Scaling `lsfg-vk.dll`, writes a valid lsfg-vk config and installs a small launcher.
- **One launch option for every game:** `~/haqgen %command%`.
- **Profiles.** A *Default* profile used by every game, plus per-game profiles. While a game runs, the panel edits that game's profile; otherwise you pick which profile to edit or create one.
- **Simple controls.** Frame generation `Off · 2x · 3x · 4x` and presets `Battery · Balanced · Quality`. Changes save automatically.
- **Advanced.** Motion quality (flow scale), lighter model, and Gamescope compatibility (on by default; the lsfg-vk fix for Steam Deck Game Mode).
- **Clear notes.** Each control says whether it applies instantly or needs a game restart (help text is behind *Show info*).
- **Health check** using lsfg-vk's own validator, a **debug log** switch and a log viewer.
- **Self-repair.** Opening the panel keeps lsfg-vk's config valid and the DLL path current.
- **Safe removal.** *Remove plugin data* lists exactly what it will delete and only removes files HaqGen created. It never touches drivers, system files, your games or Lossless Scaling.
- **No background work.** Nothing runs while you play unless you press something.

Still to be verified on a Deck: whether turning a game's frame generation on/off needs a restart in every case, and *Remove plugin data* end to end.

## Requirements

- Steam Deck running SteamOS (developed on the OLED model)
- [Decky Loader](https://decky.xyz)
- [Lossless Scaling](https://store.steampowered.com/app/993090/Lossless_Scaling/) bought on Steam and installed on the Deck, **switched to the `lsfg-vk` beta branch** (Library › Lossless Scaling › Properties › Betas › `lsfg-vk`). lsfg-vk needs the `lsfg-vk.dll` that only this branch includes.

## Setup

1. Switch Lossless Scaling to the `lsfg-vk` beta branch and let Steam finish updating it.
2. Open the Quick Access menu, go to the Decky tab and open **HaqGen**.
3. Press **Set up**. The status card shows Lossless Scaling, lsfg-vk and the launcher with ✓ when ready.
4. Press **Copy launch option** and paste `~/haqgen %command%` into each game where you want frame generation: game › Properties › Launch Options. If the field already has text, keep `%command%` only once, at the end.
5. Start the game.

## Using it

- **No game running:** the panel edits the *Default* profile, or the profile you pick under **Profile**. **Create profile** makes a profile for an installed game, starting from Default.
- **Game running:** the panel follows that game. **Save as profile for …** gives it its own settings; **Use Default instead** removes them.
- **Frame generation:** the multiplier applies instantly; switching between Off and on needs a game restart.
- **Presets** set flow scale and the model; they never change your multiplier.

## Tips for good results

- **Leave Steam's frame limit off** and cap the frame rate in the game's own settings. A steady base frame rate gives much cleaner generated frames.
- **Match your screen:** on the 90 Hz OLED, a 30 FPS cap at 3x gives 90; or set the Deck to 60 Hz and use a 30 FPS cap at 2x.
- **2x looks cleaner than 3x.** Higher multipliers invent more frames and show more warping during fast camera turns.
- **Watch the GPU.** If it is near 100%, frame generation competes with the game. Try the *Battery* preset or lower in-game settings.
- **Turn off the game's own upscaler or frame generation.**
- **Steam's performance overlay may not count generated frames**, so judge smoothness by eye.
- **Other Vulkan layers** (for example MAKO or vkBasalt) can interfere. HaqGen warns when it finds them.

## Troubleshooting

- **Run Health check** (More). It runs `lsfg-vk-cli validate` and `healthcheck` and shows the result.
- **Frame generation does nothing:** check the launch option is exactly `~/haqgen %command%`, Gamescope compatibility is on, and Lossless Scaling is on the `lsfg-vk` branch.
- **Need details:** turn on **Debug log** (More), restart the game, then use **Show log**. Turn it off again for daily play.

## Removing HaqGen

Use **More › Remove plugin data**. It shows the exact list and asks before deleting. Launch options in Steam are not edited; remove `~/haqgen %command%` from your games yourself. Restart running games to fully stop frame generation. Then uninstall HaqGen from Decky.

## Development

Stack: TypeScript and React (panel, `@decky/ui`), Python standard library (backend), built from the official Decky plugin template.

```bash
pnpm install
pnpm build                # builds dist/index.js
pnpm test                 # frontend tests (vitest)
python3.11 -m pytest      # backend tests (needs Python 3.11+)
```

Deploy to a Deck over SSH (enable SSH on the Deck first: `passwd`, then `sudo systemctl enable --now sshd`):

```bash
scripts/deploy.sh <deck-ip>
```

`scripts/deck-console.mjs` streams the Quick Access menu's console for debugging. It needs Decky's *Allow Remote CEF Debugging* and an SSH tunnel: `ssh -N -L 9222:127.0.0.1:8080 deck@<deck-ip>`, then `node scripts/deck-console.mjs 127.0.0.1:9222`.

## Credits

- [lsfg-vk](https://lsfg-vk.dev): the Vulkan layer that runs Lossless Scaling frame generation on Linux.
- [Lossless Scaling](https://store.steampowered.com/app/993090/Lossless_Scaling/): the frame generation itself.
- [Decky Loader](https://decky.xyz) and its plugin template.

## License

See [LICENSE](LICENSE). The license may still change before the first release.
