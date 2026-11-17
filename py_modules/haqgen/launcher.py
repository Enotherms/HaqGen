from __future__ import annotations

import os
from pathlib import Path

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
if [ -e "$dir/$scope.off" ]; then
  export DISABLE_LSFGVK=1
elif [ "$scope" = "default" ]; then
  export LSFGVK_PROFILE="{DEFAULT_PROFILE}"
else
  name=""
  IFS= read -r name < "$dir/$scope.profile" || [ -n "$name" ]
  export LSFGVK_PROFILE="$name"
fi
if [ ! -e "$dir/$scope.gamescope-wsi" ]; then
  export ENABLE_GAMESCOPE_WSI=0
fi
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
    tmp = path.with_name(path.name + ".tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            fh.write(SCRIPT)
            fh.flush()
            os.fsync(fh.fileno())
        os.chmod(tmp, 0o755)
        os.replace(tmp, path)
    except BaseException:
        try:
            tmp.unlink()
        except OSError:
            pass
        raise
    if str(path) not in load_manifest(manifest_path).paths:
        record_paths(manifest_path, [path])
    return path
