from __future__ import annotations

import json
import os
from pathlib import Path

from .fsutil import atomic_write
from .presets import PRESETS

DEFAULTS = {"default_preset": "balanced"}


def load_settings(path: Path) -> dict:
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return dict(DEFAULTS)
    if not isinstance(data, dict):
        return dict(DEFAULTS)
    merged = {**DEFAULTS, **data}
    if merged.get("default_preset") not in PRESETS:
        merged["default_preset"] = DEFAULTS["default_preset"]
    return merged


def save_settings(path: Path, data: dict) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_write(path, json.dumps(data, indent=2))
