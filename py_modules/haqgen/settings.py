from __future__ import annotations

import json
import os
from pathlib import Path

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
    tmp = path.with_name(path.name + ".tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            tmp.unlink()
        except OSError:
            pass
        raise
