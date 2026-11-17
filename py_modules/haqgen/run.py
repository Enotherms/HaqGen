from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass


@dataclass
class RunResult:
    ok: bool
    code: int | None
    stdout: str
    stderr: str
    timed_out: bool


def run(cmd: list[str], timeout: float = 15.0, env: dict | None = None) -> RunResult:
    full_env = None if env is None else {**os.environ, **env}
    try:
        done = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=full_env,
            shell=False,
        )
    except subprocess.TimeoutExpired as exc:
        out = exc.stdout.decode(errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or "")
        err = exc.stderr.decode(errors="replace") if isinstance(exc.stderr, bytes) else (exc.stderr or "")
        return RunResult(False, None, out, err, True)
    except (OSError, ValueError) as exc:
        return RunResult(False, None, "", str(exc), False)
    return RunResult(done.returncode == 0, done.returncode, done.stdout, done.stderr, False)
