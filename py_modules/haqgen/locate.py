from __future__ import annotations

import re
from pathlib import Path

DLL_NAMES = ("lsfg-vk.dll",)
LEGACY_DLL = "Lossless.dll"
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


_SKIP_IDS = {228980, 993090}
_SKIP_PREFIXES = ("Proton", "Steam Linux Runtime", "Steamworks Common Redistributables")


def _unescape(value: str) -> str:
    return value.replace('\\"', '"').replace("\\\\", "\\")


def list_installed_games(steam_roots: list[Path]) -> list[dict]:
    seen: dict[int, str] = {}
    for root in steam_roots:
        for library in steam_library_paths(root):
            try:
                manifests = sorted((library / "steamapps").glob("appmanifest_*.acf"))
            except OSError:
                continue
            for acf in manifests:
                try:
                    text = acf.read_text(encoding="utf-8")
                except (OSError, UnicodeDecodeError):
                    continue
                app = re.search(r'"appid"\s+"(\d+)"', text)
                name = re.search(r'"name"\s+"((?:[^"\\]|\\.)*)"', text)
                if not app or not name:
                    continue
                app_id = int(app.group(1))
                title = _unescape(name.group(1))
                if app_id in _SKIP_IDS or title.startswith(_SKIP_PREFIXES):
                    continue
                seen.setdefault(app_id, title)
    return sorted(
        ({"app_id": i, "name": n} for i, n in seen.items()), key=lambda g: g["name"].lower()
    )


def game_install_dir(steam_roots: list[Path], app_id: int) -> Path | None:
    for root in steam_roots:
        for library in steam_library_paths(root):
            acf = library / "steamapps" / f"appmanifest_{app_id}.acf"
            try:
                text = acf.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            match = re.search(r'"installdir"\s+"((?:[^"\\]|\\.)*)"', text)
            if match:
                return library / "steamapps" / "common" / _unescape(match.group(1))
    return None


def lossless_on_wrong_branch(steam_roots: list[Path]) -> bool:
    """Lossless Scaling is installed but lacks lsfg-vk.dll (not on the lsfg-vk beta branch)."""
    if find_dll(steam_roots) is not None:
        return False
    for root in steam_roots:
        for library in steam_library_paths(root):
            if (library / _APP_DIR / LEGACY_DLL).is_file():
                return True
    return False


LOSSLESS_APP_ID = 993090


def _block(text: str, name: str) -> str | None:
    match = re.search(r'"' + name + r'"\s*\{([^{}]*)\}', text)
    return match.group(1) if match else None


def lossless_branch(steam_roots: list[Path]) -> dict:
    """Which Steam branch Lossless Scaling is on (selected by the user, and currently installed)."""
    for root in steam_roots:
        for library in steam_library_paths(root):
            acf = library / "steamapps" / f"appmanifest_{LOSSLESS_APP_ID}.acf"
            try:
                text = acf.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            def beta(block: str | None) -> str | None:
                if block is None:
                    return None
                m = re.search(r'"BetaKey"\s+"([^"]*)"', block)
                return (m.group(1) if m else "") or "default"
            selected = beta(_block(text, "UserConfig")) or "default"
            mounted = beta(_block(text, "MountedConfig"))
            return {"installed": True, "selected": selected, "current": mounted or selected}
    return {"installed": False, "selected": None, "current": None}
