from __future__ import annotations

import shutil
import tarfile
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from .manifest import record_paths


@dataclass
class InstallResult:
    ok: bool
    error: str | None = None
    created: list[Path] = field(default_factory=list)


def allowed_roots(data_dir: Path, extra: list[Path] | None = None) -> list[Path]:
    return [Path(data_dir), *[Path(p) for p in (extra or [])]]


def _names(archive: Path) -> list[str]:
    if tarfile.is_tarfile(archive):
        with tarfile.open(archive) as tar:
            for m in tar.getmembers():
                if m.issym() or m.islnk() or m.isdev():
                    raise ValueError(f"unsafe archive member: {m.name}")
            return [m.name for m in tar.getmembers() if not m.isdir()]
    if zipfile.is_zipfile(archive):
        with zipfile.ZipFile(archive) as zf:
            return [n for n in zf.namelist() if not n.endswith("/")]
    raise ValueError("not a supported archive (expected .tar.gz or .zip)")


def _check_names(names: list[str], dest: Path) -> None:
    base = dest.resolve()
    for name in names:
        target = (dest / name).resolve()
        if Path(name).is_absolute() or base not in target.parents:
            raise ValueError(f"archive member escapes destination: {name}")


def extract_archive(archive: Path, dest: Path) -> None:
    dest = Path(dest)
    names = _names(archive)
    _check_names(names, dest)
    if tarfile.is_tarfile(archive):
        with tarfile.open(archive) as tar:
            tar.extractall(dest, filter="data")
    else:
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(dest)


def _snapshot(root: Path) -> set[Path]:
    return set(root.rglob("*")) if root.exists() else set()


def _remove(paths: list[Path]) -> None:
    for p in paths:
        try:
            if p.is_symlink() or p.is_file():
                p.unlink()
            elif p.is_dir():
                shutil.rmtree(p)
        except OSError:
            pass


def install_lsfg_vk(
    dest_root: Path,
    manifest_path: Path,
    fetch: Callable[[str, Path], None],
    url: str,
) -> InstallResult:
    dest_root = Path(dest_root)
    archive = dest_root / ".haqgen-download.tmp"
    created: list[Path] = []
    before: set[Path] = set()
    try:
        dest_root.mkdir(parents=True, exist_ok=True)
        before = _snapshot(dest_root)
        fetch(url, archive)
        names = _names(archive)
        _check_names(names, dest_root)
        for name in names:
            if (dest_root / name).exists():
                raise FileExistsError(f"refusing to overwrite existing file: {name}")
        extract_archive(archive, dest_root)
        archive.unlink(missing_ok=True)
        after = _snapshot(dest_root)
        new = after - before
        created = sorted(p for p in new if p.parent not in new)
        record_paths(manifest_path, created)
        return InstallResult(True, None, created)
    except Exception as exc:
        archive.unlink(missing_ok=True)
        after = _snapshot(dest_root)
        new = after - before
        _remove(sorted(p for p in new if p.parent not in new))
        return InstallResult(False, str(exc) or exc.__class__.__name__, [])
