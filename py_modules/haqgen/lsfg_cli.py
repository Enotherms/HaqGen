from __future__ import annotations

from pathlib import Path
from typing import Callable

from .run import RunResult, run as _run


def validate_config(
    cli: Path,
    config: Path | None = None,
    runner: Callable[..., RunResult] = _run,
) -> RunResult:
    args = [str(cli), "validate"] + (["--config", str(config)] if config is not None else [])
    return runner(args, timeout=15.0)


def healthcheck(cli: Path, runner: Callable[..., RunResult] = _run) -> RunResult:
    return runner([str(cli), "healthcheck"], timeout=15.0)
