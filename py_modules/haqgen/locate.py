from __future__ import annotations

import re
from pathlib import Path

DLL_NAMES = ("lsfg-vk.dll", "Lossless.dll")
_APP_DIR = Path("steamapps") / "common" / "Lossless Scaling"


def default_steam_roots(home: Path | None = None) -> list[Path]:
    home = Path(home) if home is not None else Path.home()
    return [home / ".local" / "share" / "Steam", home / ".steam" / "steam"]


def steam_library_paths(steam_root: Path) -> list[Path]:
    steam_root = Path(steam_root)
    found: list[Path] = [steam_root]
    vdf = steam_root / "steamapps" / "libraryfolders.vdf"
    try:
        text = vdf.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return found
    for match in re.finditer(r'"path"\s+"([^"]+)"', text):
        path = Path(match.group(1).replace("\\\\", "\\"))
        if path not in found:
            found.append(path)
    return found


def find_dll(steam_roots: list[Path]) -> Path | None:
    for root in steam_roots:
        for library in steam_library_paths(root):
            folder = library / _APP_DIR
            for name in DLL_NAMES:
                candidate = folder / name
                if candidate.is_file():
                    return candidate
    return None
