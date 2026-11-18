from __future__ import annotations

import os
from pathlib import Path


def atomic_write(path: Path, data: str, mode: int = 0o644) -> None:
    """Write via a fresh temp file (never following a planted symlink), then swap it in."""
    path = Path(path)
    tmp = path.with_name(path.name + ".tmp")
    if os.path.lexists(tmp):
        tmp.unlink()
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), mode)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(data)
            fh.flush()
            os.fsync(fh.fileno())
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    except BaseException:
        try:
            tmp.unlink()
        except OSError:
            pass
        raise
