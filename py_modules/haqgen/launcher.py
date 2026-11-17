from __future__ import annotations

import os
from pathlib import Path

from .manifest import load_manifest, record_paths

LAUNCHER_NAME = "haqgen-launch"
LAUNCHER_HEADER = "# HaqGen launcher"
DEFAULT_PROFILE = "HaqGen Default"

SCRIPT = f"""#!/bin/sh
{LAUNCHER_HEADER}. Steam launch option: ~/.local/bin/{LAUNCHER_NAME} %command%
id="${{SteamAppId:-${{SteamGameId:-0}}}}"
dir="${{HOME}}/.config/haqgen/games"
if [ -f "$dir/$id.profile" ]; then
  if [ -e "$dir/$id.off" ]; then
    export DISABLE_LSFGVK=1
  else
    name=""
    IFS= read -r name < "$dir/$id.profile" || [ -n "$name" ]
    export LSFGVK_PROFILE="$name"
  fi
elif [ -e "$dir/default.off" ]; then
  export DISABLE_LSFGVK=1
else
  export LSFGVK_PROFILE="{DEFAULT_PROFILE}"
fi
exec "$@"
"""


def launcher_path(local_dir: Path) -> Path:
    return Path(local_dir) / "bin" / LAUNCHER_NAME


def install_launcher(local_dir: Path, manifest_path: Path) -> Path:
    path = launcher_path(local_dir)
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
