from __future__ import annotations

import json
import os
import shutil
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


class ConfigError(Exception):
    pass


@dataclass
class Profile:
    name: str
    active_in: list[str] = field(default_factory=list)
    multiplier: int = 2
    flow_scale: float = 1.0
    performance_mode: bool = False
    pacing: str = "vsync"
    override_present_mode: bool = True
    preserve_swapchain_image_count: bool = False
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class Config:
    dll: str | None = None
    allow_fp16: bool = True
    log_level: str | None = None
    log_file: str | None = None
    profiles: list[Profile] = field(default_factory=list)
    extra_global: dict[str, Any] = field(default_factory=dict)


_GLOBAL_KEYS = {"dll", "allow_fp16", "log_level", "log_file"}
_PROFILE_KEYS = {
    "name",
    "active_in",
    "multiplier",
    "flow_scale",
    "performance_mode",
    "pacing",
    "override_present_mode",
    "preserve_swapchain_image_count",
}


def _expect(value: Any, kind: type | tuple, what: str) -> Any:
    if kind is float and isinstance(value, int) and not isinstance(value, bool):
        return float(value)
    if isinstance(value, bool) and kind is not bool:
        raise ConfigError(f"{what} has the wrong type")
    if not isinstance(value, kind):
        raise ConfigError(f"{what} has the wrong type")
    return value


def load_config(path: Path) -> Config:
    path = Path(path)
    if not path.exists():
        return Config()
    try:
        data = tomllib.loads(path.read_text(encoding="utf-8"))
    except (tomllib.TOMLDecodeError, UnicodeDecodeError) as exc:
        raise ConfigError(f"Config file is not valid TOML: {exc}") from exc

    g = data.get("global", {})
    if not isinstance(g, dict):
        raise ConfigError("[global] must be a table")
    cfg = Config(
        dll=_expect(g["dll"], str, "dll") if "dll" in g else None,
        allow_fp16=_expect(g.get("allow_fp16", True), bool, "allow_fp16"),
        log_level=_expect(g["log_level"], str, "log_level") if "log_level" in g else None,
        log_file=_expect(g["log_file"], str, "log_file") if "log_file" in g else None,
        extra_global={k: v for k, v in g.items() if k not in _GLOBAL_KEYS},
    )
    raw_profiles = data.get("profile", [])
    if not isinstance(raw_profiles, list):
        raise ConfigError("[[profile]] must be an array of tables")
    for raw in raw_profiles:
        if not isinstance(raw, dict):
            raise ConfigError("[[profile]] must be an array of tables")
        active = _expect(raw.get("active_in", []), list, "active_in")
        for item in active:
            _expect(item, str, "active_in entry")
        cfg.profiles.append(
            Profile(
                name=_expect(raw.get("name", ""), str, "name"),
                active_in=list(active),
                multiplier=_expect(raw.get("multiplier", 2), int, "multiplier"),
                flow_scale=_expect(raw.get("flow_scale", 1.0), float, "flow_scale"),
                performance_mode=_expect(
                    raw.get("performance_mode", False), bool, "performance_mode"
                ),
                pacing=_expect(raw.get("pacing", "vsync"), str, "pacing"),
                override_present_mode=_expect(
                    raw.get("override_present_mode", True), bool, "override_present_mode"
                ),
                preserve_swapchain_image_count=_expect(
                    raw.get("preserve_swapchain_image_count", False),
                    bool,
                    "preserve_swapchain_image_count",
                ),
                extra={k: v for k, v in raw.items() if k not in _PROFILE_KEYS},
            )
        )
    return cfg


def _key(name: str) -> str:
    if name and all(c.isalnum() or c in "_-" for c in name) and name.isascii():
        return name
    return json.dumps(name, ensure_ascii=False)


def _value(v: Any) -> str:
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, list):
        return "[" + ", ".join(_value(i) for i in v) + "]"
    if isinstance(v, dict):
        return "{ " + ", ".join(f"{_key(k)} = {_value(x)}" for k, x in v.items()) + " }"
    raise ConfigError(f"Cannot write value of type {type(v).__name__}")


CONFIG_VERSION = 2


def dump_config(cfg: Config) -> str:
    lines: list[str] = [f"version = {CONFIG_VERSION}", "", "[global]"]
    if cfg.dll is not None:
        lines.append(f"dll = {_value(cfg.dll)}")
    lines.append(f"allow_fp16 = {_value(cfg.allow_fp16)}")
    if cfg.log_level is not None:
        lines.append(f"log_level = {_value(cfg.log_level)}")
    if cfg.log_file is not None:
        lines.append(f"log_file = {_value(cfg.log_file)}")
    for k, v in cfg.extra_global.items():
        lines.append(f"{_key(k)} = {_value(v)}")
    for p in cfg.profiles:
        lines += [
            "",
            "[[profile]]",
            f"name = {_value(p.name)}",
            f"active_in = {_value(p.active_in)}",
            f"multiplier = {_value(p.multiplier)}",
            f"flow_scale = {_value(p.flow_scale)}",
            f"performance_mode = {_value(p.performance_mode)}",
            f"pacing = {_value(p.pacing)}",
            f"override_present_mode = {_value(p.override_present_mode)}",
            f"preserve_swapchain_image_count = {_value(p.preserve_swapchain_image_count)}",
        ]
        for k, v in p.extra.items():
            lines.append(f"{_key(k)} = {_value(v)}")
    return "\n".join(lines) + "\n"


def save_config(path: Path, cfg: Config) -> None:
    path = Path(path)
    text = dump_config(cfg)
    path.parent.mkdir(parents=True, exist_ok=True)
    backup = path.with_name(path.name + ".haqgen.bak")
    if path.exists() and not backup.exists():
        shutil.copy2(path, backup)
    tmp = path.with_name(path.name + ".tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            fh.write(text)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            tmp.unlink()
        except OSError:
            pass
        raise


def needs_upgrade(path: Path) -> bool:
    """True when an existing, readable config lacks lsfg-vk 2's required version line."""
    try:
        data = tomllib.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError, UnicodeDecodeError):
        return False
    return data.get("version") != CONFIG_VERSION
