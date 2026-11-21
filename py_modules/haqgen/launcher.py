from __future__ import annotations

import os
from pathlib import Path

from .fsutil import atomic_write
from .manifest import load_manifest, record_paths

LAUNCHER_NAME = "haqgen"
LAUNCHER_HEADER = "# HaqGen launcher"
DEFAULT_PROFILE = "HaqGen Default"
LAUNCH_OPTION = f"~/{LAUNCHER_NAME} %command%"

SCRIPT = f"""#!/bin/sh
{LAUNCHER_HEADER}. Steam launch option: {LAUNCH_OPTION}
id=""
for candidate in "${{SteamAppId-}}" "${{SteamGameId-}}" "${{STEAM_COMPAT_APP_ID-}}"; do
  case "$candidate" in
    ''|*[!0-9]*) ;;
    *) id="$candidate"; break ;;
  esac
done
dir="${{HOME}}/.config/haqgen/games"
LSFGVK_CONFIG="${{HOME}}/.config/lsfg-vk/conf.toml"
export LSFGVK_CONFIG
scope="default"
if [ -n "$id" ] && [ -f "$dir/$id.profile" ]; then
  scope="$id"
fi
off=""
if [ -e "$dir/$scope.off" ]; then
  off=1
  export DISABLE_LSFGVK=1
elif [ "$scope" = "default" ]; then
  export LSFGVK_PROFILE="{DEFAULT_PROFILE}"
else
  name=""
  IFS= read -r name < "$dir/$scope.profile" || [ -n "$name" ]
  export LSFGVK_PROFILE="$name"
fi
haq=""
if [ -z "$off" ] && [ -f "$dir/$scope.haqengine" ] && [ -f "${{HOME}}/.local/share/vulkan/implicit_layer.d/haqengine.json" ]; then
  IFS= read -r haq < "$dir/$scope.haqengine" || [ -n "$haq" ]
fi
case "$haq" in
  2|3|4)
    unset LSFGVK_PROFILE
    export DISABLE_LSFGVK=1
    export HAQENGINE=1
    export HAQENGINE_MULTIPLIER="$haq"
    ;;
esac
if [ -z "$off" ] && [ ! -e "$dir/$scope.gamescope-wsi" ]; then
  export ENABLE_GAMESCOPE_WSI=0
fi
cap=""
if [ -f "$dir/$scope.fpscap" ]; then
  IFS= read -r cap < "$dir/$scope.fpscap" || [ -n "$cap" ]
fi
case "$cap" in
  ''|*[!0-9]*) ;;
  *)
    export VKD3D_FRAME_RATE="$cap"
    export DXVK_FRAME_RATE="$cap"
    limit="dxgi.maxFrameRate = $cap; d3d9.maxFrameRate = $cap; dxvk.maxFrameRate = $cap"
    if [ -n "${{DXVK_CONFIG-}}" ]; then
      DXVK_CONFIG="$DXVK_CONFIG; $limit"
    else
      DXVK_CONFIG="$limit"
    fi
    export DXVK_CONFIG
    ;;
esac
exec "$@"
"""


def launcher_path(home_dir: Path) -> Path:
    return Path(home_dir) / LAUNCHER_NAME


def install_launcher(home_dir: Path, manifest_path: Path) -> Path:
    path = launcher_path(home_dir)
    if path.exists():
        try:
            ours = LAUNCHER_HEADER in path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            ours = False
        if not ours:
            raise FileExistsError(f"refusing to overwrite {path}: it was not created by HaqGen")
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_write(path, SCRIPT, mode=0o755)
    if str(path) not in load_manifest(manifest_path).paths:
        record_paths(manifest_path, [path])
    return path


def launcher_current(home_dir: Path) -> bool:
    """True when ~/haqgen exists and matches this version of HaqGen exactly."""
    try:
        return launcher_path(home_dir).read_text(encoding="utf-8") == SCRIPT
    except (OSError, UnicodeDecodeError):
        return False


def is_ours(home_dir: Path) -> bool:
    try:
        return LAUNCHER_HEADER in launcher_path(home_dir).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return False
