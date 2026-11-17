from __future__ import annotations

import dataclasses
import re

from .config import Config, Profile

PRESETS: dict[str, dict] = {
    "battery": {"flow_scale": 0.5, "performance_mode": True},
    "balanced": {"flow_scale": 0.75, "performance_mode": False},
    "quality": {"flow_scale": 1.0, "performance_mode": False},
}


def profile_name(app_id: int, game_name: str) -> str:
    cleaned = re.sub(r"\s+", " ", game_name).strip()
    return f"HaqGen {app_id} {cleaned}".strip()


def apply_preset(profile: Profile, preset: str) -> Profile:
    values = PRESETS.get(preset.lower())
    if values is None:
        raise ValueError(f"Unknown preset: {preset}")
    return dataclasses.replace(profile, **values)


def upsert_profile(cfg: Config, profile: Profile) -> Config:
    profiles = list(cfg.profiles)
    for i, existing in enumerate(profiles):
        if existing.name == profile.name:
            profiles[i] = profile
            break
    else:
        profiles.append(profile)
    return dataclasses.replace(cfg, profiles=profiles)


def remove_profile(cfg: Config, name: str) -> Config:
    return dataclasses.replace(cfg, profiles=[p for p in cfg.profiles if p.name != name])


def clamp_settings(multiplier: int, flow_scale: float) -> tuple[int, float]:
    return max(2, min(4, int(multiplier))), max(0.25, min(1.0, float(flow_scale)))
