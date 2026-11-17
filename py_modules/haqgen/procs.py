from __future__ import annotations

import re
from pathlib import Path

_DRIVE = re.compile(r"^[A-Za-z]:")


def _normalize(arg: str) -> str:
    return _DRIVE.sub("", arg.replace("\\", "/"))


def find_game_exe(install_dir: Path, proc_root: Path = Path("/proc")) -> str | None:
    marker = f"/steamapps/common/{Path(install_dir).name}/".lower()
    try:
        entries = [p for p in Path(proc_root).iterdir() if p.name.isdigit()]
    except OSError:
        return None
    for entry in sorted(entries, key=lambda p: int(p.name)):
        try:
            raw = (entry / "cmdline").read_bytes()
        except OSError:
            continue
        for arg in raw.decode("utf-8", errors="replace").split("\0"):
            path = _normalize(arg)
            if path.lower().endswith(".exe") and marker in path.lower():
                return path.rsplit("/", 1)[-1]
    return None
