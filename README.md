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
- **FPS cap per profile** (`Off · 30 · 40 · 45 · 60`). Caps the game's real frame rate before frame generation (VKD3D-Proton for DX12 games, DXVK for DX9–11), which gives steadier generated frames than Steam's limiter.
- **Advanced.** Motion quality (flow scale), lighter model, and Gamescope compatibility (on by default; the lsfg-vk fix for Steam Deck Game Mode; may turn off HDR in that game).
- **Clear notes.** Each control says whether it applies instantly or needs a game restart (help text is behind *Show info*).
- **Flatpak apps** (for example emulators or Heroic from Discover): turn lsfg-vk on per app. HaqGen installs lsfg-vk's official Flatpak runtime extension (user-level, from Flathub) and adds only the permissions lsfg-vk needs; your own Flatpak permissions are kept.
- **Troubleshooting.** Health check using lsfg-vk's own validator, a debug log switch, a log viewer and *Reset lsfg-vk config* (keeps a backup).
- **Self-repair.** Opening the panel keeps lsfg-vk's config valid and the DLL path current.
- **Safe removal.** *Remove plugin data* lists exactly what it will delete and only removes files HaqGen created. It never touches drivers, system files, your games or Lossless Scaling.
- **No background work.** Nothing runs while you play unless you press something.

Verified on a Steam Deck OLED: setup, frame generation at 2x/3x, Off after a game restart, and *Remove plugin data* (removes only HaqGen's files and leaves Lossless Scaling untouched).

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
- **Game running:** the panel follows that game. **Save as profile for …** gives it its own settings; **Delete profile** (asks first) sends it back to Default.
- **Frame generation:** 2x/3x/4x apply instantly. Switching between Off and on needs a game restart, because lsfg-vk is turned on or off when the game starts (the panel shows a restart reminder).
- **Presets** set flow scale and the model; they never change your multiplier.
- **FPS cap** needs a game restart. It works with frame generation on or off.
- **Danger zone** holds *Reset profiles* and *Remove plugin data*; both ask before doing anything.

## Flatpak apps

Open **Flatpak apps** in the panel and switch an app on. The first time, HaqGen installs `org.freedesktop.Platform.VulkanLayer.lsfgvk` for that app's runtime (24.08 or 25.08), which can take a minute. It then grants the app read/write access to `~/.config/lsfg-vk`, read-only access to the Lossless Scaling folder, and sets `LSFGVK_CONFIG` and `LSFGVK_PROFILE` for it. Flatpak apps use the Default profile. Restart the app after switching. *Remove plugin data* removes these permissions and uninstalls only the extensions HaqGen installed.

## Anti-cheat

HaqGen never changes game files and never reads or writes game memory. The only thing loaded into a game is lsfg-vk's Vulkan layer, a graphics component similar to the Steam overlay; the launcher only sets environment variables. HaqGen does not try to hide from anti-cheat. Some online games forbid overlays or injected layers, so check the game's rules and try it offline first. If a game complains, set its profile to Off or remove the launch option.

## Tips for good results

- **Leave Steam's frame limit off** (or at your screen's refresh rate). Steam's limiter counts generated frames too, so it would cut real frames. Use HaqGen's **FPS cap** (or the game's own limiter) instead: a steady base frame rate gives much cleaner generated frames.
- **Match your screen:** on the 90 Hz OLED, FPS cap 30 with 3x gives 90, or FPS cap 45 with 2x gives 90 if the game can hold 45.
- **2x looks cleaner than 3x.** Higher multipliers invent more frames and show more warping during fast camera turns.
- **Watch the GPU.** If it is near 100%, frame generation competes with the game. Try the *Battery* preset or lower in-game settings.
- **Turn off the game's own upscaler or frame generation.**
- **Steam's performance overlay may not count generated frames**, so judge smoothness by eye.
- **Other Vulkan layers** (for example MAKO or vkBasalt) can interfere. HaqGen warns when it finds them.

## Troubleshooting

- **Run Health check** (Troubleshooting). It runs `lsfg-vk-cli validate` and `healthcheck` and shows the result.
- **Frame generation does nothing:** check the launch option is exactly `~/haqgen %command%`, Gamescope compatibility is on, and Lossless Scaling is on the `lsfg-vk` branch.
- **Need details:** turn on **Debug log** (Troubleshooting), restart the game, then use **Show log**. Turn it off again for daily play.
- **lsfg-vk reports a broken config** (for example after another tool edited it): use **Reset lsfg-vk config**. It saves a backup first.

## Removing HaqGen

Use **Danger zone › Remove plugin data**. It shows the exact list and asks before deleting. Launch options in Steam are not edited; remove `~/haqgen %command%` from your games yourself. Restart running games to fully stop frame generation. Then uninstall HaqGen from Decky.

## Development

Stack: TypeScript and React (panel, `@decky/ui`), Python standard library (backend), built from the official Decky plugin template.

```bash
pnpm install
pnpm build                # builds dist/index.js
pnpm test                 # frontend tests (vitest)
python3.11 -m pytest      # backend tests (needs Python 3.11+)
```

To install on a Deck, copy `dist/`, `main.py`, `plugin.json`, `package.json`, `LICENSE` and `py_modules/` into `~/homebrew/plugins/HaqGen` (owned by root) and restart Decky (`sudo systemctl restart plugin_loader`).

`scripts/deck-console.mjs` streams the Quick Access menu's console for debugging. It needs Decky's *Allow Remote CEF Debugging* and an SSH tunnel: `ssh -N -L 9222:127.0.0.1:8080 deck@<deck-ip>`, then `node scripts/deck-console.mjs 127.0.0.1:9222`.

> **Security: switch development access off when you are done.**
> - *Allow Remote CEF Debugging* lets anything that can reach the debugger control Steam's interface (including your account and store). Turn it off again in Decky settings › Developer as soon as you finish debugging, and close the SSH tunnel.
> - SSH with a password is reachable by every device on your network. When you are not developing, run `sudo systemctl disable --now sshd` on the Deck; if you keep it on, use a strong password or SSH keys.
> - Only enable these on networks you trust, never on public Wi-Fi.

## Credits

- [lsfg-vk](https://lsfg-vk.dev): the Vulkan layer that runs Lossless Scaling frame generation on Linux.
- [Lossless Scaling](https://store.steampowered.com/app/993090/Lossless_Scaling/): the frame generation itself.
- [Decky Loader](https://decky.xyz) and its plugin template.

## License

BSD 3-Clause License. See [LICENSE](LICENSE).
