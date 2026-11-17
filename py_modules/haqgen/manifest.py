from __future__ import annotations

import json
import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Manifest:
    version: int = 1
    paths: list[str] = field(default_factory=list)


@dataclass
class RemovalPlan:
    to_delete: list[Path]
    refused: list[tuple[str, str]]
    missing: list[Path]
    roots: list[Path] = field(default_factory=list)
    files: list[Path] = field(default_factory=list)


@dataclass
class RemovalReport:
    deleted: list[Path] = field(default_factory=list)
    failed: list[tuple[Path, str]] = field(default_factory=list)


def load_manifest(path: Path) -> Manifest:
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        paths = [p for p in data.get("paths", []) if isinstance(p, str)]
        return Manifest(version=int(data.get("version", 1)), paths=paths)
    except (OSError, ValueError, AttributeError, TypeError):
        return Manifest()


def record_paths(manifest_path: Path, new_paths: list[Path]) -> None:
    manifest_path = Path(manifest_path)
    current = load_manifest(manifest_path)
    for p in new_paths:
        if str(p) not in current.paths:
            current.paths.append(str(p))
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = manifest_path.with_name(manifest_path.name + ".tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump({"version": current.version, "paths": current.paths}, fh, indent=2)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, manifest_path)
    except BaseException:
        try:
            tmp.unlink()
        except OSError:
            pass
        raise


def _inside(path: Path, roots: list[Path]) -> bool:
    return any(path != r and r in path.parents for r in roots)


def _refusal(path: Path, roots: list[Path], files: list[Path] | None = None) -> str | None:
    if not path.is_absolute():
        return "not an absolute path"
    if ".." in path.parts:
        return "contains '..'"
    if files and path in files:
        if path.is_symlink():
            return "is a symlink"
        return None
    resolved_roots = [Path(os.path.realpath(r)) for r in roots]
    own = Path(os.path.realpath(path.parent)) / path.name
    if own in resolved_roots:
        return "is an allowed root itself"
    if not _inside(own, resolved_roots):
        return "outside HaqGen's own directories"
    if not _inside(Path(os.path.realpath(path)), resolved_roots):
        return "resolves outside HaqGen's own directories"
    return None


def plan_removal(
    manifest: Manifest, allowed_roots: list[Path], allowed_files: list[Path] | None = None
) -> RemovalPlan:
    roots = [Path(r) for r in allowed_roots]
    files = [Path(f) for f in (allowed_files or [])]
    plan = RemovalPlan(to_delete=[], refused=[], missing=[], roots=roots, files=files)
    for raw in manifest.paths:
        path = Path(raw)
        reason = _refusal(path, roots, files)
        if reason:
            plan.refused.append((raw, reason))
        elif not os.path.lexists(path):
            plan.missing.append(path)
        else:
            plan.to_delete.append(path)
    return plan


def execute_removal(plan: RemovalPlan) -> RemovalReport:
    report = RemovalReport()
    for path in plan.to_delete:
        reason = _refusal(path, plan.roots, plan.files)
        if reason:
            report.failed.append((path, reason))
            continue
        try:
            if path.is_symlink() or path.is_file():
                path.unlink()
            elif path.is_dir():
                shutil.rmtree(path)
            report.deleted.append(path)
        except OSError as exc:
            report.failed.append((path, str(exc)))
    return report


def replace_manifest(manifest_path: Path, paths: list[str]) -> None:
    manifest_path = Path(manifest_path)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = manifest_path.with_name(manifest_path.name + ".tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump({"version": 1, "paths": list(paths)}, fh, indent=2)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, manifest_path)
    except BaseException:
        try:
            tmp.unlink()
        except OSError:
            pass
        raise
