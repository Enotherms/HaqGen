from __future__ import annotations

import dataclasses
import json
import os
import re
import shutil
import time
import ssl
import urllib.request
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .config import Config, ConfigError, Profile, load_config, needs_upgrade, save_config
from .fsutil import atomic_write
from . import flatpak as fp
from .install import allowed_roots, install_lsfg_vk, lsfg_present
from .lsfg_cli import healthcheck, validate_config
from .locate import (
    find_dll,
    list_installed_games,
    lossless_branch,
    lossless_on_wrong_branch,
)
from .settings import load_settings, save_settings
from .launcher import DEFAULT_PROFILE, LAUNCH_OPTION, install_launcher, is_ours, launcher_current, launcher_path
from .manifest import execute_removal, load_manifest, plan_removal, record_paths, replace_manifest
from .presets import (
    PRESETS,
    apply_preset,
    clamp_settings,
    profile_name,
    remove_profile,
    upsert_profile,
)

PROFILE_PREFIX = "HaqGen "
MARKER_SUFFIXES = ("profile", "off", "gamescope-wsi", "fpscap")
MAX_DOWNLOAD = 64 * 1024 * 1024
KEEP_BACKUPS = 3


def _app_id(value) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError("invalid game id")
    return value


def _scope_id(value) -> int | None:
    return None if value is None else _app_id(value)


def _game_name(value) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > 200:
        raise ValueError("invalid game name")
    return value


def _settings(value) -> dict:
    if not isinstance(value, dict):
        raise ValueError("settings must be an object")
    if "exe_names" in value and not (
        isinstance(value["exe_names"], list) and all(isinstance(n, str) for n in value["exe_names"])
    ):
        raise ValueError("exe_names must be a list of names")
    return value
FPS_CAP_RANGE = (10, 240)


@dataclass
class Paths:
    config_path: Path
    manifest_path: Path
    data_dir: Path
    steam_roots: list[Path]
    local_dir: Path
    log_path: Path | None = None
    cli_path: Path | None = None
    settings_path: Path | None = None
    haqgen_dir: Path | None = None

    def home(self) -> Path:
        return self.local_dir.parent

    def haqgen_config(self) -> Path:
        return self.haqgen_dir or self.config_path.parent.parent / "haqgen"

    def games_dir(self) -> Path:
        return self.haqgen_config() / "games"

    def settings_file(self) -> Path:
        return self.settings_path or self.data_dir / "settings.json"

    def cli(self) -> Path:
        return self.cli_path or self.local_dir / "bin" / "lsfg-vk-cli"


CA_BUNDLES = (
    Path("/etc/ssl/certs/ca-certificates.crt"),
    Path("/etc/ca-certificates/extracted/tls-ca-bundle.pem"),
    Path("/etc/ssl/cert.pem"),
)


def find_ca_bundle(candidates=None) -> str | None:
    for path in CA_BUNDLES if candidates is None else candidates:
        if Path(path).is_file():
            return str(path)
    return None


def download(url: str, dest: Path) -> None:
    context = ssl.create_default_context(cafile=find_ca_bundle())
    dest = Path(dest)
    if os.path.lexists(dest):
        dest.unlink()
    try:
        with urllib.request.urlopen(url, timeout=30, context=context) as resp:
            length = int((getattr(resp, "headers", {}) or {}).get("Content-Length") or 0)
            if length > MAX_DOWNLOAD:
                raise ValueError("download is larger than expected")
            total = 0
            with open(dest, "xb") as out:
                while chunk := resp.read(1 << 16):
                    total += len(chunk)
                    if total > MAX_DOWNLOAD:
                        raise ValueError("download is larger than expected")
                    out.write(chunk)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise


def _is_haqgen(p: Profile) -> bool:
    return p.name.startswith(PROFILE_PREFIX)


def _fail(error: str) -> dict:
    return {"ok": False, "error": error}


def _installed(paths: Paths) -> bool:
    return lsfg_present(paths.local_dir)


def _matching_preset(p: Profile) -> str | None:
    for key, values in PRESETS.items():
        if all(getattr(p, field) == value for field, value in values.items()):
            return key
    return None


def _profile_dict(p: Profile, exists: bool) -> dict:
    return {
        "exists": exists,
        "preset": _matching_preset(p),
        "name": p.name,
        "multiplier": p.multiplier,
        "flow_scale": p.flow_scale,
        "performance_mode": p.performance_mode,
        "exe_names": list(p.active_in),
    }


def _base_default() -> Profile:
    return apply_preset(Profile(name=DEFAULT_PROFILE), "balanced")


def _find(cfg: Config, name: str) -> Profile | None:
    return next((p for p in cfg.profiles if p.name == name), None)


def _default_profile(paths: Paths, app_id: int, game_name: str, cfg: Config | None = None) -> Profile:
    name = profile_name(app_id, game_name)
    default = _find(cfg, DEFAULT_PROFILE) if cfg is not None else None
    if default is not None:
        return dataclasses.replace(default, name=name, active_in=[], extra=dict(default.extra))
    preset = load_settings(paths.settings_file())["default_preset"]
    return apply_preset(Profile(name=name), preset)


def _apply_settings(profile: Profile, settings: dict) -> Profile:
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
    return profile


def _roots(paths: Paths) -> list[Path]:
    return allowed_roots(paths.data_dir, paths.local_dir) + [paths.haqgen_config()]


def _games(paths: Paths) -> Path:
    d = paths.games_dir()
    if not d.exists():
        d.mkdir(parents=True)
        record_paths(paths.manifest_path, [d])
    return d


def _marker(paths: Paths, app_id: int | None, suffix: str) -> Path:
    return paths.games_dir() / f"{'default' if app_id is None else int(app_id)}.{suffix}"


def _write_marker(path: Path, text: str) -> None:
    atomic_write(path, text)


def _refresh_launcher(paths: Paths) -> None:
    """A new HaqGen version may ship a newer launcher; refresh ~/haqgen, but only if it is ours."""
    if is_ours(paths.home()) and not launcher_current(paths.home()):
        install_launcher(paths.home(), paths.manifest_path)


def get_state(paths: Paths) -> dict:
    try:
        _refresh_launcher(paths)
    except OSError:
        pass
    dll = find_dll(paths.steam_roots)
    state = {
        "installed": _installed(paths),
        "dll_found": dll is not None,
        "dll_path": str(dll) if dll else None,
        "profiles": [],
        "launcher_installed": launcher_path(paths.home()).exists(),
        "ls_branch": lossless_branch(paths.steam_roots),
        "other_layers": _other_layers(paths),
        "debug_log": False,
        "wrong_branch": dll is None and lossless_on_wrong_branch(paths.steam_roots),
        "error": None,
    }
    try:
        cfg = load_config(paths.config_path)
        state["profiles"] = [p.name for p in cfg.profiles if _is_haqgen(p)]
        state["debug_log"] = cfg.log_level == "debug"
        if paths.config_path.exists() and launcher_path(paths.home()).exists():
            _self_repair(paths, cfg, dll)
    except ConfigError as exc:
        state["error"] = str(exc)
    except OSError as exc:
        state["error"] = str(exc)
    return state


_OWN_LAYERS = ("vklayer_lsfgvk", "steamoverlay", "steamfossilize")


def _always_on(manifest: Path) -> bool:
    """Layers with an enable_environment only run when a launcher opts in, so they don't interfere."""
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return True
    layers = data.get("layers") or [data.get("layer") or {}] if isinstance(data, dict) else []
    return not any(isinstance(l, dict) and l.get("enable_environment") for l in layers)


def _other_layers(paths: Paths) -> list[str]:
    d = paths.local_dir / "share" / "vulkan" / "implicit_layer.d"
    try:
        names = {f.name[: -len(".json")] for f in d.iterdir() if f.name.endswith(".json") and _always_on(f)}
    except OSError:
        return []
    names = {n[: -len(".x86")] if n.endswith(".x86") else n for n in names}
    return sorted(n for n in names if not n.lower().startswith(_OWN_LAYERS))


def _self_repair(paths: Paths, cfg: Config, dll: Path | None) -> None:
    """Keep lsfg-vk's config usable: current DLL, version 2, Default profile, no stale links."""
    changed = needs_upgrade(paths.config_path)
    if dll is not None and cfg.dll != str(dll):
        cfg, changed = dataclasses.replace(cfg, dll=str(dll)), True
    if _find(cfg, DEFAULT_PROFILE) is None:
        cfg, changed = upsert_profile(cfg, _base_default()), True
    if changed:
        save_config(paths.config_path, cfg)
    names = {p.name for p in cfg.profiles}
    d = paths.games_dir()
    if d.is_dir():
        for marker in d.glob("*.profile"):
            try:
                name = marker.read_text(encoding="utf-8").strip()
            except OSError:
                continue
            if name not in names:
                game_id = marker.name[: -len(".profile")]
                for suffix in MARKER_SUFFIXES:
                    (d / f"{game_id}.{suffix}").unlink(missing_ok=True)


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
        install_launcher(paths.home(), paths.manifest_path)
    except FileExistsError as exc:
        return {"ok": False, "error": "launcher_conflict", "detail": str(exc)}
    except OSError as exc:
        return _fail(str(exc))
    try:
        cfg = load_config(paths.config_path)
        cfg = dataclasses.replace(cfg, dll=str(dll))
        if _find(cfg, DEFAULT_PROFILE) is None:
            cfg = upsert_profile(cfg, _base_default())
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
        return {**_profile_dict(_default_profile(paths, app_id, game_name), False), "error": str(exc)}
    for p in cfg.profiles:
        if p.name == name:
            return _profile_dict(p, True)
    return _profile_dict(_default_profile(paths, app_id, game_name, cfg), False)


def save_profile(paths: Paths, app_id: int, game_name: str, settings: dict) -> dict:
    try:
        app_id, game_name, settings = _app_id(app_id), _game_name(game_name), _settings(settings)
        name = profile_name(app_id, game_name)
        cfg = load_config(paths.config_path)
        current = _find(cfg, name)
        profile = _apply_settings(current or _default_profile(paths, app_id, game_name, cfg), settings)
        save_config(paths.config_path, upsert_profile(cfg, profile))
        _write_marker(_games(paths) / f"{int(app_id)}.profile", name + "\n")
    except (ConfigError, ValueError, OSError) as exc:
        return _fail(str(exc))
    return {"ok": True, "profile": _profile_dict(profile, True)}


def launch_option() -> str:
    return LAUNCH_OPTION


def _haqgen_profile_names(paths: Paths) -> list[str]:
    try:
        return [p.name for p in load_config(paths.config_path).profiles if _is_haqgen(p)]
    except ConfigError:
        return []


def removal_preview(paths: Paths) -> dict:
    plan = plan_removal(load_manifest(paths.manifest_path), _roots(paths), [launcher_path(paths.home())])
    return {
        "delete": [str(p) for p in plan.to_delete],
        "missing": [str(p) for p in plan.missing],
        "refused": [{"path": p, "reason": r} for p, r in plan.refused],
        "profiles": _haqgen_profile_names(paths),
        "flatpak_apps": sorted(_load_flatpak(paths)["apps"]),
        "flatpak_extensions": _load_flatpak(paths)["owned_branches"],
    }


def _drop_haqgen_profiles(paths: Paths) -> None:
    cfg = load_config(paths.config_path)
    for p in [p for p in cfg.profiles if _is_haqgen(p)]:
        cfg = remove_profile(cfg, p.name)
    save_config(paths.config_path, cfg)


def remove_all(paths: Paths, confirmed: bool, run=None) -> dict:
    if not confirmed:
        return _fail("not_confirmed")
    _remove_flatpak(paths, run)
    manifest = load_manifest(paths.manifest_path)
    plan = plan_removal(manifest, _roots(paths), [launcher_path(paths.home())])
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


def _clear_markers(paths: Paths) -> None:
    d = paths.games_dir()
    if d.is_dir():
        for f in d.iterdir():
            if f.is_file() and not f.is_symlink():
                f.unlink()


def reset_defaults(paths: Paths) -> dict:
    try:
        _clear_markers(paths)
        if paths.config_path.exists():
            _drop_haqgen_profiles(paths)
    except (ConfigError, OSError) as exc:
        return _fail(str(exc))
    return {"ok": True}


def _tail(path: Path | None, max_lines: int) -> str:
    if path is None:
        return ""
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return "\n".join(line.rstrip("\n") for line in deque(fh, maxlen=max_lines))
    except OSError:
        return ""


def _lsfg_log(paths: Paths) -> Path:
    return paths.home() / "lsfg-vk.log"


def read_log(paths: Paths, max_lines: int = 200) -> str:
    plugin = _tail(paths.log_path, max_lines)
    lsfg = _tail(_lsfg_log(paths), max_lines)
    if not lsfg:
        return plugin
    return f"{plugin}\n\n--- lsfg-vk debug log ---\n{lsfg}".lstrip()


def set_debug_log(paths: Paths, on: bool) -> dict:
    """Turns lsfg-vk's debug log (written to ~/lsfg-vk.log) on or off."""
    try:
        cfg = load_config(paths.config_path)
        if on:
            cfg = dataclasses.replace(cfg, log_level="debug", log_file=str(_lsfg_log(paths)))
        else:
            cfg = dataclasses.replace(cfg, log_level=None, log_file=None)
        save_config(paths.config_path, cfg)
        if not on:
            _lsfg_log(paths).unlink(missing_ok=True)
    except (ConfigError, OSError) as exc:
        return _fail(str(exc))
    return {"ok": True}


def delete_profile(paths: Paths, app_id: int, game_name: str) -> dict:
    try:
        app_id, game_name = _app_id(app_id), _game_name(game_name)
        if paths.config_path.exists():
            cfg = load_config(paths.config_path)
            save_config(paths.config_path, remove_profile(cfg, profile_name(app_id, game_name)))
        for suffix in MARKER_SUFFIXES:
            _marker(paths, app_id, suffix).unlink(missing_ok=True)
    except (ConfigError, OSError, ValueError) as exc:
        return _fail(str(exc))
    return {"ok": True}


def list_games(paths: Paths) -> list[dict]:
    return list_installed_games(paths.steam_roots)


def get_settings(paths: Paths) -> dict:
    return load_settings(paths.settings_file())


def set_default_preset(paths: Paths, preset: str) -> dict:
    if preset not in PRESETS:
        return _fail(f"Unknown preset: {preset}")
    try:
        data = load_settings(paths.settings_file())
        data["default_preset"] = preset
        save_settings(paths.settings_file(), data)
    except OSError as exc:
        return _fail(str(exc))
    return {"ok": True}


def health_check(paths: Paths) -> dict:
    cli = paths.cli()
    if not cli.exists():
        return {"ok": False, "summary": "lsfg-vk is not installed.", "details": ""}
    results = [("validate", validate_config(cli, paths.config_path)), ("healthcheck", healthcheck(cli))]
    details = "\n\n".join(
        f"$ lsfg-vk-cli {name}\n{(r.stdout + r.stderr).strip()}" for name, r in results
    )
    ok = all(r.ok for _, r in results)
    summary = "Everything looks good." if ok else "lsfg-vk found a problem. See details below."
    return {"ok": ok, "summary": summary, "details": details}


def get_scope(paths: Paths, app_id: int | None, game_name: str | None) -> dict:
    try:
        cfg = load_config(paths.config_path)
    except ConfigError as exc:
        cfg, error = Config(), str(exc)
    else:
        error = None
    own = None
    if app_id is not None and game_name:
        own = _find(cfg, profile_name(app_id, game_name))
    if own is not None:
        scope, profile, marker_id = "game", own, app_id
    else:
        scope, profile, marker_id = "default", _find(cfg, DEFAULT_PROFILE) or _base_default(), None
    return {
        "scope": scope,
        "game": game_name if app_id is not None else None,
        "profile": _profile_dict(profile, True),
        "enabled": not _marker(paths, marker_id, "off").exists(),
        "gamescope_compat": not _marker(paths, marker_id, "gamescope-wsi").exists(),
        "fps_cap": _read_fps_cap(_marker(paths, marker_id, "fpscap")),
        "error": error,
    }


def save_default(paths: Paths, settings: dict) -> dict:
    try:
        settings = _settings(settings)
        cfg = load_config(paths.config_path)
        profile = _apply_settings(_find(cfg, DEFAULT_PROFILE) or _base_default(), settings)
        save_config(paths.config_path, upsert_profile(cfg, profile))
    except (ConfigError, ValueError, OSError) as exc:
        return _fail(str(exc))
    return {"ok": True, "profile": _profile_dict(profile, True)}


def set_enabled(paths: Paths, app_id: int | None, enabled: bool, run=None) -> dict:
    try:
        app_id = _scope_id(app_id)
        marker = _games(paths) / _marker(paths, app_id, "off").name
        if enabled:
            marker.unlink(missing_ok=True)
        else:
            _write_marker(marker, "")
        if app_id is None:
            _sync_flatpak(paths)
    except (OSError, ValueError) as exc:
        return _fail(str(exc))
    return {"ok": True}


_GAME_PROFILE = re.compile(r"^HaqGen (\d+) (.+)$")


def list_profiles(paths: Paths) -> list[dict]:
    entries = [{"app_id": None, "game": None, "label": "Default"}]
    try:
        cfg = load_config(paths.config_path)
    except ConfigError:
        return entries
    games = []
    for p in cfg.profiles:
        match = _GAME_PROFILE.match(p.name)
        if match:
            games.append({"app_id": int(match.group(1)), "game": match.group(2), "label": match.group(2)})
    return entries + sorted(games, key=lambda g: g["label"].lower())


def set_gamescope_compat(paths: Paths, app_id: int | None, on: bool, run=None) -> dict:
    """On (default) makes the launcher set ENABLE_GAMESCOPE_WSI=0; off leaves Gamescope's layer alone."""
    try:
        app_id = _scope_id(app_id)
        marker = _games(paths) / _marker(paths, app_id, "gamescope-wsi").name
        if on:
            marker.unlink(missing_ok=True)
        else:
            _write_marker(marker, "")
        if app_id is None:
            _sync_flatpak(paths)
    except (OSError, ValueError) as exc:
        return _fail(str(exc))
    return {"ok": True}


def reset_lsfg_config(paths: Paths) -> dict:
    """Saves a copy of lsfg-vk's config, then writes a clean, valid one with the Default profile."""
    backup = None
    try:
        if paths.config_path.exists():
            backup = paths.config_path.with_name(f"conf.toml.haqgen-backup-{time.strftime('%Y%m%d-%H%M%S')}")
            shutil.copy2(paths.config_path, backup)
            old = sorted(paths.config_path.parent.glob("conf.toml.haqgen-backup-*"))
            for stale in old[:-KEEP_BACKUPS]:
                stale.unlink(missing_ok=True)
        dll = find_dll(paths.steam_roots)
        cfg = Config(dll=str(dll) if dll else None, profiles=[_base_default()])
        save_config(paths.config_path, cfg)
        _clear_markers(paths)
    except OSError as exc:
        return _fail(str(exc))
    return {"ok": True, "backup": str(backup) if backup else None}


def _read_fps_cap(path: Path) -> int:
    try:
        text = path.read_text(encoding="utf-8").strip()
    except OSError:
        return 0
    return int(text) if text.isdigit() and FPS_CAP_RANGE[0] <= int(text) <= FPS_CAP_RANGE[1] else 0


def set_fps_cap(paths: Paths, app_id: int | None, cap) -> dict:
    """Base FPS cap applied by the launcher at game start; 0 removes it."""
    if isinstance(cap, bool) or not isinstance(cap, int):
        return _fail("FPS cap must be a whole number")
    try:
        app_id = _scope_id(app_id)
    except ValueError as exc:
        return _fail(str(exc))
    if cap != 0 and not FPS_CAP_RANGE[0] <= cap <= FPS_CAP_RANGE[1]:
        return _fail(f"FPS cap must be between {FPS_CAP_RANGE[0]} and {FPS_CAP_RANGE[1]}")
    try:
        marker = _games(paths) / _marker(paths, app_id, "fpscap").name
        if cap == 0:
            marker.unlink(missing_ok=True)
        else:
            _write_marker(marker, f"{cap}\n")
    except OSError as exc:
        return _fail(str(exc))
    return {"ok": True}




def _flatpak_state_file(paths: Paths) -> Path:
    return paths.data_dir / "flatpak.json"


def _load_flatpak(paths: Paths) -> dict:
    try:
        data = json.loads(_flatpak_state_file(paths).read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return {
                "owned_branches": list(data.get("owned_branches", [])),
                "apps": dict(data.get("apps", {})),
                "added_remote": bool(data.get("added_remote", False)),
            }
    except (OSError, ValueError):
        pass
    return {"owned_branches": [], "apps": {}, "added_remote": False}


def _save_flatpak(paths: Paths, state: dict) -> None:
    paths.data_dir.mkdir(parents=True, exist_ok=True)
    atomic_write(_flatpak_state_file(paths), json.dumps(state, indent=2))


def _runner(paths: Paths, run):
    return run or fp.make_runner(paths.home())


def flatpak_state(paths: Paths, run=None) -> dict:
    run = _runner(paths, run)
    if not fp.available(run):
        return {"available": False, "apps": []}
    enabled = _load_flatpak(paths)["apps"]
    apps = [{**a, "enabled": a["app_id"] in enabled} for a in fp.list_apps(run)]
    return {"available": True, "apps": apps}


def _wanted_overrides(paths: Paths) -> dict:
    dll = find_dll(paths.steam_roots)
    filesystems = [f"{paths.config_path.parent}:ro"]
    if dll is not None:
        filesystems.append(f"{dll.parent}:ro")
    env = {"LSFGVK_CONFIG": str(paths.config_path), "LSFGVK_PROFILE": DEFAULT_PROFILE}
    if _marker(paths, None, "off").exists():
        env["DISABLE_LSFGVK"] = "1"
    elif not _marker(paths, None, "gamescope-wsi").exists():
        env["ENABLE_GAMESCOPE_WSI"] = "0"
    return {"filesystems": filesystems, "env": env}


def flatpak_set(paths: Paths, app_id, on: bool, run=None) -> dict:
    """Turns lsfg-vk on or off for one Flatpak app (it uses the Default profile)."""
    try:
        app_id = fp.valid_app_id(app_id)
    except ValueError as exc:
        return _fail(str(exc))
    run = _runner(paths, run)
    state = _load_flatpak(paths)
    try:
        if not on:
            added = state["apps"].pop(app_id, None)
            if added is not None:
                fp.disable_overrides(paths.home(), app_id, added)
            _save_flatpak(paths, state)
            return {"ok": True}
        if app_id in state["apps"]:
            return {"ok": True}
        app = next((a for a in fp.list_apps(run) if a["app_id"] == app_id), None)
        if app is None:
            return _fail("flatpak_app_not_found")
        if not app["supported"]:
            return _fail("flatpak_runtime_unsupported")
        if app["branch"] not in fp.installed_branches(run):
            if not fp.has_user_remote(run):
                if not fp.add_user_remote(run).ok:
                    return _fail("flatpak_install_failed")
                state["added_remote"] = True
                _save_flatpak(paths, state)
            result = fp.install_extension(run, app["branch"])
            if not result.ok:
                return {"ok": False, "error": "flatpak_install_failed", "detail": (result.stderr or result.stdout).strip()[:300]}
            state["owned_branches"] = sorted(set(state["owned_branches"]) | {app["branch"]})
        state["apps"][app_id] = fp.enable_overrides(paths.home(), app_id, _wanted_overrides(paths))
        _save_flatpak(paths, state)
    except (OSError, ValueError) as exc:
        return _fail(str(exc))
    return {"ok": True}


def _remove_flatpak(paths: Paths, run=None) -> None:
    state = _load_flatpak(paths)
    if not state["apps"] and not state["owned_branches"] and not state["added_remote"]:
        return
    run = _runner(paths, run)
    for app_id, added in list(state["apps"].items()):
        try:
            fp.disable_overrides(paths.home(), app_id, added)
        except (OSError, ValueError):
            pass
    for branch in state["owned_branches"]:
        try:
            fp.uninstall_extension(run, branch)
        except ValueError:
            pass
    if state["added_remote"] and not fp.user_refs_from_flathub(run):
        fp.remove_user_remote(run)
    _flatpak_state_file(paths).unlink(missing_ok=True)


def _sync_flatpak(paths: Paths) -> None:
    """Re-applies Default's Off and Gamescope settings to every Flatpak app HaqGen manages."""
    state = _load_flatpak(paths)
    if not state["apps"]:
        return
    wanted = _wanted_overrides(paths)
    for app_id, added in list(state["apps"].items()):
        fp.disable_overrides(paths.home(), app_id, added)
        state["apps"][app_id] = fp.enable_overrides(paths.home(), app_id, wanted)
    _save_flatpak(paths, state)
