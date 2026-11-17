from __future__ import annotations

import hashlib
import tarfile
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from .manifest import record_paths

LAYER_JSON = Path("share/vulkan/implicit_layer.d/VkLayer_LSFGVK_frame_generation.json")
REQUIRED_FILES = (Path("bin/lsfg-vk-cli"), Path("lib/liblsfg-vk-layer.so"), LAYER_JSON)


@dataclass
class InstallResult:
    ok: bool
    error: str | None = None
    created: list[Path] = field(default_factory=list)


def lsfg_present(local_dir: Path) -> bool:
    return all((Path(local_dir) / rel).is_file() for rel in REQUIRED_FILES)


def allowed_roots(data_dir: Path, local_dir: Path | None = None) -> list[Path]:
    roots = [Path(data_dir)]
    if local_dir is not None:
        local = Path(local_dir)
        roots += [
            local / "bin",
            local / "lib",
            local / "share" / "vulkan" / "implicit_layer.d",
            local / "share" / "applications",
            local / "share" / "icons" / "hicolor" / "256x256" / "apps",
        ]
    return roots


def _names(archive: Path) -> list[Path]:
    if tarfile.is_tarfile(archive):
        with tarfile.open(archive) as tar:
            for m in tar.getmembers():
                if m.issym() or m.islnk() or m.isdev():
                    raise ValueError(f"unsafe archive member: {m.name}")
            return [Path(m.name) for m in tar.getmembers() if m.isfile()]
    if zipfile.is_zipfile(archive):
        with zipfile.ZipFile(archive) as zf:
            return [Path(n) for n in zf.namelist() if not n.endswith("/")]
    raise ValueError("not a supported archive (expected .tar.gz, .tar.xz or .zip)")


def _check_names(names: list[Path], dest: Path) -> None:
    base = dest.resolve()
    for name in names:
        target = (dest / name).resolve()
        if name.is_absolute() or base not in target.parents:
            raise ValueError(f"archive member escapes destination: {name}")


def extract_archive(archive: Path, dest: Path) -> None:
    dest = Path(dest)
    _check_names(_names(archive), dest)
    if tarfile.is_tarfile(archive):
        with tarfile.open(archive) as tar:
            try:
                tar.extractall(dest, filter="data")
            except TypeError:
                tar.extractall(dest)
    else:
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(dest)


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def install_lsfg_vk(
    dest_root: Path,
    manifest_path: Path,
    fetch: Callable[[str, Path], None],
    url: str,
    sha256: str | None = None,
    work_dir: Path | None = None,
) -> InstallResult:
    dest_root = Path(dest_root)
    work = Path(work_dir) if work_dir is not None else dest_root
    archive = work / ".haqgen-download.tmp"
    created: list[Path] = []
    try:
        dest_root.mkdir(parents=True, exist_ok=True)
        work.mkdir(parents=True, exist_ok=True)
        fetch(url, archive)
        if sha256 is not None and _sha256(archive) != sha256.lower():
            raise ValueError("Checksum mismatch: the downloaded file is not the expected release")
        names = _names(archive)
        _check_names(names, dest_root)
        for name in names:
            if (dest_root / name).exists():
                raise FileExistsError(f"refusing to overwrite existing file: {name}")
        created = [dest_root / name for name in names]
        extract_archive(archive, dest_root)
        archive.unlink(missing_ok=True)
        record_paths(manifest_path, created)
        return InstallResult(True, None, created)
    except Exception as exc:
        archive.unlink(missing_ok=True)
        for path in created:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass
        return InstallResult(False, str(exc) or exc.__class__.__name__, [])
