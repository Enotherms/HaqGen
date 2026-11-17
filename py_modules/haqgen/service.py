from __future__ import annotations

import dataclasses
import os
import urllib.request
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .config import Config, ConfigError, Profile, load_config, save_config
from .install import allowed_roots, install_lsfg_vk, lsfg_present
from .lsfg_cli import validate_config
from .locate import find_dll
from .manifest import execute_removal, load_manifest, plan_removal, replace_manifest
from .presets import (
    PRESETS,
    apply_preset,
    clamp_settings,
    profile_name,
    remove_profile,
    upsert_profile,
)

PROFILE_PREFIX = "HaqGen "


@dataclass
class Paths:
    config_path: Path
    manifest_path: Path
    data_dir: Path
    steam_roots: list[Path]
    local_dir: Path
    log_path: Path | None = None
    cli_path: Path | None = None

    def cli(self) -> Path:
        return self.cli_path or self.local_dir / "bin" / "lsfg-vk-cli"


def download(url: str, dest: Path) -> None:
    with urllib.request.urlopen(url, timeout=30) as resp, open(dest, "wb") as out:
        while chunk := resp.read(1 << 16):
            out.write(chunk)


def _is_haqgen(p: Profile) -> bool:
    return p.name.startswith(PROFILE_PREFIX)


def _fail(error: str) -> dict:
    return {"ok": False, "error": error}


def _installed(paths: Paths) -> bool:
    return lsfg_present(paths.local_dir)


def _profile_dict(p: Profile, exists: bool) -> dict:
    return {
        "exists": exists,
        "name": p.name,
        "multiplier": p.multiplier,
        "flow_scale": p.flow_scale,
        "performance_mode": p.performance_mode,
        "exe_names": list(p.active_in),
    }


def _default_profile(app_id: int, game_name: str) -> Profile:
    return apply_preset(Profile(name=profile_name(app_id, game_name)), "balanced")


def get_state(paths: Paths) -> dict:
    dll = find_dll(paths.steam_roots)
    state = {
        "installed": _installed(paths),
        "dll_found": dll is not None,
        "dll_path": str(dll) if dll else None,
        "profiles": [],
        "error": None,
    }
    try:
        cfg = load_config(paths.config_path)
        state["profiles"] = [p.name for p in cfg.profiles if _is_haqgen(p)]
    except ConfigError as exc:
        state["error"] = str(exc)
    return state


def setup(
    paths: Paths,
    fetch: Callable | None = None,
    url: str | None = None,
    sha256: str | None = None,
) -> dict:
    dll = find_dll(paths.steam_roots)
    if dll is None:
        return _fail("dll_not_found")
    if not _installed(paths):
        if not url or fetch is None:
            return _fail("install_url_unknown")
        result = install_lsfg_vk(
            paths.local_dir, paths.manifest_path, fetch, url, sha256=sha256, work_dir=paths.data_dir
        )
        if not result.ok:
            return {"ok": False, "error": "install_failed", "detail": result.error}
    try:
        cfg = load_config(paths.config_path)
        cfg = dataclasses.replace(cfg, dll=str(dll))
        save_config(paths.config_path, cfg)
    except (ConfigError, OSError) as exc:
        return _fail(str(exc))
    validated = False
    if paths.cli().exists():
        validated = validate_config(paths.cli(), paths.config_path).ok
    return {"ok": True, "dll_path": str(dll), "validated": validated}


def get_profile(paths: Paths, app_id: int, game_name: str) -> dict:
    name = profile_name(app_id, game_name)
    try:
        cfg = load_config(paths.config_path)
    except ConfigError as exc:
        return {**_profile_dict(_default_profile(app_id, game_name), False), "error": str(exc)}
    for p in cfg.profiles:
        if p.name == name:
            return _profile_dict(p, True)
    return _profile_dict(_default_profile(app_id, game_name), False)


def save_profile(paths: Paths, app_id: int, game_name: str, settings: dict) -> dict:
    name = profile_name(app_id, game_name)
    try:
        cfg = load_config(paths.config_path)
        current = next((p for p in cfg.profiles if p.name == name), None)
        profile = current or _default_profile(app_id, game_name)
        if settings.get("preset"):
            profile = apply_preset(profile, str(settings["preset"]))
        if "multiplier" in settings or "flow_scale" in settings:
            m, f = clamp_settings(
                settings.get("multiplier", profile.multiplier),
                settings.get("flow_scale", profile.flow_scale),
            )
            profile = dataclasses.replace(profile, multiplier=m, flow_scale=f)
        if "performance_mode" in settings:
            profile = dataclasses.replace(profile, performance_mode=bool(settings["performance_mode"]))
        if "exe_names" in settings:
            names = [str(n).strip() for n in settings["exe_names"] if str(n).strip()]
            profile = dataclasses.replace(profile, active_in=names)
        save_config(paths.config_path, upsert_profile(cfg, profile))
    except (ConfigError, ValueError, OSError) as exc:
        return _fail(str(exc))
    return {"ok": True, "profile": _profile_dict(profile, True)}


def launch_option(app_id: int, game_name: str) -> str:
    quoted = profile_name(app_id, game_name).replace("'", "'\\''")
    return f"LSFGVK_PROFILE='{quoted}' %command%"


def _haqgen_profile_names(paths: Paths) -> list[str]:
    try:
        return [p.name for p in load_config(paths.config_path).profiles if _is_haqgen(p)]
    except ConfigError:
        return []


def removal_preview(paths: Paths) -> dict:
    plan = plan_removal(load_manifest(paths.manifest_path), allowed_roots(paths.data_dir, paths.local_dir))
    return {
        "delete": [str(p) for p in plan.to_delete],
        "missing": [str(p) for p in plan.missing],
        "refused": [{"path": p, "reason": r} for p, r in plan.refused],
        "profiles": _haqgen_profile_names(paths),
    }


def _drop_haqgen_profiles(paths: Paths) -> None:
    cfg = load_config(paths.config_path)
    for p in [p for p in cfg.profiles if _is_haqgen(p)]:
        cfg = remove_profile(cfg, p.name)
    save_config(paths.config_path, cfg)


def remove_all(paths: Paths, confirmed: bool) -> dict:
    if not confirmed:
        return _fail("not_confirmed")
    manifest = load_manifest(paths.manifest_path)
    plan = plan_removal(manifest, allowed_roots(paths.data_dir, paths.local_dir))
    report = execute_removal(plan)
    keep = [p for p, _ in plan.refused] + [str(p) for p, _ in report.failed]
    replace_manifest(paths.manifest_path, keep)
    try:
        if paths.config_path.exists():
            _drop_haqgen_profiles(paths)
    except (ConfigError, OSError) as exc:
        return {"ok": False, "error": str(exc), "deleted": [str(p) for p in report.deleted]}
    return {
        "ok": not report.failed,
        "deleted": [str(p) for p in report.deleted],
        "failed": [{"path": str(p), "reason": r} for p, r in report.failed],
        "skipped": [{"path": p, "reason": r} for p, r in plan.refused],
    }


def reset_defaults(paths: Paths) -> dict:
    try:
        if paths.config_path.exists():
            _drop_haqgen_profiles(paths)
    except (ConfigError, OSError) as exc:
        return _fail(str(exc))
    return {"ok": True}


def read_log(paths: Paths, max_lines: int = 200) -> str:
    if paths.log_path is None:
        return ""
    try:
        with open(paths.log_path, encoding="utf-8", errors="replace") as fh:
            return "\n".join(line.rstrip("\n") for line in deque(fh, maxlen=max_lines))
    except OSError:
        return ""


def delete_profile(paths: Paths, app_id: int, game_name: str) -> dict:
    try:
        if paths.config_path.exists():
            cfg = load_config(paths.config_path)
            save_config(paths.config_path, remove_profile(cfg, profile_name(app_id, game_name)))
    except (ConfigError, OSError) as exc:
        return _fail(str(exc))
    return {"ok": True}
