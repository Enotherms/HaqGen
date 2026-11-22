"""Install, update and remove HaqEngine from a pinned, checksum-verified release.

Only `libhaqengine.so` and the layer manifest template are taken from the archive; nothing in it is
executed. Files are swapped in by rename, so a running game keeps the old library and a failed update
leaves the previous version in place. Files at the install paths that are not HaqEngine's are never
replaced or removed.
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Callable

from .fsutil import atomic_write
from .install import InstallResult, _names, _sha256, extract_archive
from .manifest import load_manifest, record_paths

LAYER_NAME = "VK_LAYER_ENOTHERMS_haqengine"
LIB_NAME = "libhaqengine.so"
TEMPLATE_NAME = "haqengine.json.in"


def lib_path(local_dir: Path) -> Path:
    return Path(local_dir) / "lib" / LIB_NAME


def layer_manifest_path(local_dir: Path) -> Path:
    return Path(local_dir) / "share" / "vulkan" / "implicit_layer.d" / "haqengine.json"


def version_path(data_dir: Path) -> Path:
    return Path(data_dir) / "haqengine-version"


def is_haqengine_manifest(path: Path) -> bool:
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        return data["layer"]["name"] == LAYER_NAME
    except (OSError, ValueError, KeyError, TypeError):
        return False


def _read_version(data_dir: Path) -> str | None:
    try:
        text = version_path(data_dir).read_text(encoding="utf-8").strip()
    except OSError:
        return None
    return text or None


def engine_status(local_dir: Path, data_dir: Path, pinned: str) -> dict:
    installed = lib_path(local_dir).is_file() and is_haqengine_manifest(layer_manifest_path(local_dir))
    version = _read_version(data_dir) if installed else None
    return {"installed": installed, "version": version, "pinned": pinned, "update_available": installed and version != pinned}


def _ownership_problem(local_dir: Path, record_to: Path | None) -> str | None:
    """Why the files at the install paths may not be touched, or None when they are absent or HaqEngine's."""
    manifest = layer_manifest_path(local_dir)
    lib = lib_path(local_dir)
    manifest_ours = is_haqengine_manifest(manifest)
    if os.path.lexists(manifest) and not manifest_ours:
        return f"{manifest} belongs to another layer"
    if os.path.lexists(lib) and not manifest_ours:
        recorded = record_to is not None and str(lib) in load_manifest(record_to).paths
        if not recorded:
            return f"{lib} exists but is not a HaqEngine install"
    if os.path.islink(lib) or os.path.islink(manifest):
        return "refusing to replace a symbolic link"
    return None


def _member(names: list[Path], file_name: str) -> Path:
    found = [n for n in names if n.name == file_name]
    if len(found) != 1:
        raise ValueError(f"release must contain exactly one {file_name}")
    return found[0]


def _render(template: str, lib: Path) -> str:
    text = template.replace("@LIBRARY_PATH@", json.dumps(str(lib))[1:-1])
    data = json.loads(text)
    if data.get("layer", {}).get("name") != LAYER_NAME or data["layer"].get("library_path") != str(lib):
        raise ValueError("release manifest template is not HaqEngine's")
    return text


def _replace_file(src: Path, dest: Path, mode: int) -> None:
    tmp = dest.with_name(dest.name + ".haqgen-new")
    if os.path.lexists(tmp):
        tmp.unlink()
    try:
        shutil.copyfile(src, tmp)
        os.chmod(tmp, mode)
        os.replace(tmp, dest)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise


def install_haqengine(
    local_dir: Path,
    data_dir: Path,
    record_to: Path,
    fetch: Callable[[str, Path], None],
    url: str,
    sha256: str,
    version: str,
) -> InstallResult:
    local_dir, data_dir = Path(local_dir), Path(data_dir)
    archive = data_dir / ".haqengine-download.tmp"
    unpack = data_dir / ".haqengine-unpack"
    lib, manifest = lib_path(local_dir), layer_manifest_path(local_dir)
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
        if os.path.lexists(archive):
            archive.unlink()
        shutil.rmtree(unpack, ignore_errors=True)
        fetch(url, archive)
        if _sha256(archive) != sha256.lower():
            raise ValueError("Checksum mismatch: the downloaded file is not the expected release")
        names = _names(archive)
        lib_member = _member(names, LIB_NAME)
        template_member = _member(names, TEMPLATE_NAME)
        unpack.mkdir()
        extract_archive(archive, unpack)
        rendered = _render((unpack / template_member).read_text(encoding="utf-8"), lib)
        problem = _ownership_problem(local_dir, record_to)
        if problem:
            raise FileExistsError(problem)
        lib.parent.mkdir(parents=True, exist_ok=True)
        manifest.parent.mkdir(parents=True, exist_ok=True)
        _replace_file(unpack / lib_member, lib, 0o755)
        atomic_write(manifest, rendered)
        atomic_write(version_path(data_dir), version + "\n")
        record_paths(record_to, [lib, manifest])
        return InstallResult(True, None, [lib, manifest])
    except Exception as exc:
        return InstallResult(False, str(exc) or exc.__class__.__name__, [])
    finally:
        archive.unlink(missing_ok=True)
        shutil.rmtree(unpack, ignore_errors=True)


def remove_haqengine(local_dir: Path, data_dir: Path, record_to: Path | None = None) -> tuple[bool, str | None]:
    problem = _ownership_problem(local_dir, record_to)
    if problem:
        return False, problem
    try:
        layer_manifest_path(local_dir).unlink(missing_ok=True)
        lib_path(local_dir).unlink(missing_ok=True)
        version_path(data_dir).unlink(missing_ok=True)
    except OSError as exc:
        return False, str(exc)
    return True, None
