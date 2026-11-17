from __future__ import annotations

from pathlib import Path
from typing import Callable

from .run import RunResult, run as _run


def validate_config(
    cli: Path,
    config: Path | None = None,
    runner: Callable[..., RunResult] = _run,
) -> RunResult:
    env = {"LSFGVK_CONFIG": str(config)} if config is not None else None
    return runner([str(cli), "validate"], timeout=15.0, env=env)


def healthcheck(cli: Path, runner: Callable[..., RunResult] = _run) -> RunResult:
    return runner([str(cli), "healthcheck"], timeout=15.0)
