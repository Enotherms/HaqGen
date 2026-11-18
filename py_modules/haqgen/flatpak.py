"""lsfg-vk for Flatpak apps, following lsfg-vk's official Flatpak guide.

Installs the lsfg-vk Vulkan layer extension into Flatpak runtimes (user-level, from Flathub) and
adds per-app permissions by editing the app's override file. HaqGen only ever removes entries it
added itself, so the user's own Flatpak permissions are kept.
"""
from __future__ import annotations

import configparser
import io
import os
import re
from pathlib import Path
from typing import Callable

from .fsutil import atomic_write
from .run import RunResult, run as _run

EXTENSION_ID = "org.freedesktop.Platform.VulkanLayer.lsfgvk"
SUPPORTED_BRANCHES = ("24.08", "25.08")
FLATHUB_URL = "https://dl.flathub.org/repo/flathub.flatpakrepo"
_FREEDESKTOP = "org.freedesktop.Platform"
_APP_ID = re.compile(r"^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+){2,}$")
_BRANCH = re.compile(r"^\d{2}\.\d{2}$")

Runner = Callable[..., RunResult]


def clean_env(home) -> dict:
    """Environment for the flatpak command, without Decky's bundled library paths."""
    env = {k: v for k, v in os.environ.items() if not k.startswith("LD_")}
    env["HOME"] = str(home)
    uid = os.getuid()
    env.setdefault("XDG_RUNTIME_DIR", f"/run/user/{uid}")
    env.setdefault("DBUS_SESSION_BUS_ADDRESS", f"unix:path=/run/user/{uid}/bus")
    parts = [p for p in env.get("PATH", "").split(":") if p]
    for extra in ("/usr/bin", "/bin"):
        if extra not in parts:
            parts.append(extra)
    env["PATH"] = ":".join(parts)
    return env


def make_runner(home) -> Runner:
    def runner(cmd, timeout=30.0):
        return _run(cmd, timeout=timeout, env=clean_env(home), inherit_env=False)

    return runner


def valid_app_id(app_id) -> str:
    if not isinstance(app_id, str) or len(app_id) > 255 or not _APP_ID.match(app_id):
        raise ValueError("invalid Flatpak app id")
    return app_id


def _valid_branch(branch) -> str:
    if branch not in SUPPORTED_BRANCHES:
        raise ValueError("unsupported Flatpak runtime version")
    return branch


def available(run: Runner) -> bool:
    return run(["flatpak", "--version"], 10).ok


def runtime_branch(run: Runner, runtime: str) -> str | None:
    """Freedesktop runtime version an app uses (KDE/GNOME runtimes are built on one)."""
    parts = runtime.split("/")
    if len(parts) < 2:
        return None
    name, branch = parts[0], parts[-1]
    if name == _FREEDESKTOP:
        return branch if _BRANCH.match(branch) else None
    meta = run(["flatpak", "info", "--show-metadata", f"{name}//{branch}"], 30)
    if not meta.ok:
        return None
    parser = configparser.ConfigParser(interpolation=None, strict=False)
    try:
        parser.read_string(meta.stdout)
    except configparser.Error:
        return None
    section = "Extension org.freedesktop.Platform.GL"
    if not parser.has_section(section):
        return None
    candidates = parser.get(section, "versions", fallback="").split(";") + [parser.get(section, "version", fallback="")]
    return next((c for c in candidates if _BRANCH.match(c.strip())), None)


def list_apps(run: Runner) -> list[dict]:
    result = run(["flatpak", "list", "--app", "--columns=application,name,runtime"], 30)
    if not result.ok:
        return []
    apps, cache = [], {}
    for line in result.stdout.splitlines():
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        app_id, name, runtime = (p.strip() for p in parts)
        try:
            valid_app_id(app_id)
        except ValueError:
            continue
        if runtime not in cache:
            cache[runtime] = runtime_branch(run, runtime)
        branch = cache[runtime]
        apps.append({"app_id": app_id, "name": name or app_id, "branch": branch, "supported": branch in SUPPORTED_BRANCHES})
    return apps


def installed_branches(run: Runner) -> set[str]:
    result = run(["flatpak", "list", "--user", "--runtime", "--columns=application,branch"], 30)
    branches = set()
    for line in result.stdout.splitlines() if result.ok else []:
        parts = line.split("\t")
        if len(parts) == 2 and parts[0].strip() == EXTENSION_ID:
            branches.add(parts[1].strip())
    return branches


def install_extension(run: Runner, branch: str) -> RunResult:
    branch = _valid_branch(branch)
    run(["flatpak", "remote-add", "--user", "--if-not-exists", "flathub", FLATHUB_URL], 60)
    return run(["flatpak", "install", "--user", "--noninteractive", "-y", "flathub", f"{EXTENSION_ID}//{branch}"], 600)


def uninstall_extension(run: Runner, branch: str) -> RunResult:
    branch = _valid_branch(branch)
    return run(["flatpak", "uninstall", "--user", "--noninteractive", "-y", f"{EXTENSION_ID}//{branch}"], 300)




def override_path(home, app_id: str) -> Path:
    return Path(home) / ".local" / "share" / "flatpak" / "overrides" / valid_app_id(app_id)


def _parser() -> configparser.ConfigParser:
    parser = configparser.ConfigParser(interpolation=None, strict=False, delimiters=("=",))
    parser.optionxform = str
    return parser


def _load(path: Path) -> configparser.ConfigParser:
    parser = _parser()
    if path.exists():
        parser.read_string(path.read_text(encoding="utf-8"))
    return parser


def _save(path: Path, parser: configparser.ConfigParser) -> None:
    out = io.StringIO()
    parser.write(out, space_around_delimiters=False)
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_write(path, out.getvalue())


def _check(value: str, filesystem: bool = False) -> str:
    if not isinstance(value, str) or any(c in value for c in "\r\n") or (filesystem and ";" in value):
        raise ValueError("invalid override value")
    return value


def enable_overrides(home, app_id: str, wanted: dict) -> dict:
    """Adds the wanted filesystems and environment entries; returns exactly what was added."""
    path = override_path(home, app_id)
    filesystems = [_check(f, filesystem=True) for f in wanted.get("filesystems", [])]
    env = {_check(k, filesystem=True): _check(v) for k, v in wanted.get("env", {}).items()}
    created = not path.exists()
    parser = _load(path)
    added: dict = {"filesystems": [], "env": {}}
    current = [f for f in parser.get("Context", "filesystems", fallback="").split(";") if f]
    for f in filesystems:
        if f not in current:
            current.append(f)
            added["filesystems"].append(f)
    if current:
        if not parser.has_section("Context"):
            parser.add_section("Context")
        parser.set("Context", "filesystems", ";".join(current) + ";")
    for key, value in env.items():
        if not parser.has_section("Environment"):
            parser.add_section("Environment")
        if parser.get("Environment", key, fallback=None) != value:
            parser.set("Environment", key, value)
            added["env"][key] = value
    _save(path, parser)
    if created:
        added["created"] = True
    return added


def disable_overrides(home, app_id: str, added: dict) -> None:
    path = override_path(home, app_id)
    if not path.exists():
        return
    parser = _load(path)
    if parser.has_section("Context"):
        kept = [f for f in parser.get("Context", "filesystems", fallback="").split(";") if f and f not in added.get("filesystems", [])]
        if kept:
            parser.set("Context", "filesystems", ";".join(kept) + ";")
        else:
            parser.remove_option("Context", "filesystems")
        if not parser.options("Context"):
            parser.remove_section("Context")
    if parser.has_section("Environment"):
        for key in added.get("env", {}):
            parser.remove_option("Environment", key)
        if not parser.options("Environment"):
            parser.remove_section("Environment")
    if added.get("created") and not parser.sections():
        path.unlink(missing_ok=True)
    else:
        _save(path, parser)
