import hashlib
import io
import json
import shutil
import tarfile
from pathlib import Path

from haqgen import haqengine
from haqgen.manifest import load_manifest

URL = "https://example.invalid/haqengine.tar.gz"
VERSION = "0.1.0"
TOP = "haqengine-0.1.0-x86_64-linux"
TEMPLATE = """{
  "file_format_version": "1.2.0",
  "layer": {
    "name": "VK_LAYER_ENOTHERMS_haqengine",
    "type": "GLOBAL",
    "library_path": "@LIBRARY_PATH@",
    "api_version": "1.3.0",
    "implementation_version": "1",
    "description": "HaqEngine frame generation",
    "functions": { "vkNegotiateLoaderLayerInterfaceVersion": "vkNegotiateLoaderLayerInterfaceVersion" },
    "enable_environment": { "HAQENGINE": "1" },
    "disable_environment": { "DISABLE_HAQENGINE": "1" }
  }
}
"""


def _add(tar, name, data):
    info = tarfile.TarInfo(name)
    info.size = len(data)
    tar.addfile(info, io.BytesIO(data))


def make_release(tmp_path, *, lib=b"ELF-v1", template=TEMPLATE, include_lib=True, symlink=False, escape=False, name="release.tar.gz"):
    path = tmp_path / name
    with tarfile.open(path, "w:gz") as tar:
        if include_lib:
            _add(tar, f"{TOP}/libhaqengine.so", lib)
        _add(tar, f"{TOP}/haqengine.json.in", template.encode())
        _add(tar, f"{TOP}/install.sh", b"#!/bin/sh\necho hi\n")
        if symlink:
            info = tarfile.TarInfo(f"{TOP}/link")
            info.type = tarfile.SYMTYPE
            info.linkname = "/etc/passwd"
            tar.addfile(info)
        if escape:
            _add(tar, "../evil", b"x")
    return path, hashlib.sha256(path.read_bytes()).hexdigest()


def fetcher(src):
    return lambda url, dest: shutil.copyfile(src, dest)


def dirs(tmp_path):
    return tmp_path / "local", tmp_path / "data", tmp_path / "data" / "manifest.json"


def install(tmp_path, release, sha):
    local, data, record = dirs(tmp_path)
    return haqengine.install_haqengine(local, data, record, fetcher(release), URL, sha, VERSION)


def leftovers(data):
    return [p.name for p in data.glob(".haqengine*")] if data.exists() else []


def test_install_places_library_and_manifest(tmp_path):
    local, data, record = dirs(tmp_path)
    release, sha = make_release(tmp_path)
    result = install(tmp_path, release, sha)
    assert result.ok, result.error
    lib = haqengine.lib_path(local)
    assert lib.read_bytes() == b"ELF-v1"
    layer = json.loads(haqengine.layer_manifest_path(local).read_text())["layer"]
    assert layer["name"] == haqengine.LAYER_NAME
    assert layer["library_path"] == str(lib)
    assert haqengine.version_path(data).read_text().strip() == "0.1.0"
    recorded = load_manifest(record).paths
    assert str(lib) in recorded and str(haqengine.layer_manifest_path(local)) in recorded
    assert not list(local.rglob("install.sh"))
    assert leftovers(data) == []


def test_checksum_mismatch_is_refused(tmp_path):
    local, data, _ = dirs(tmp_path)
    release, _ = make_release(tmp_path)
    result = install(tmp_path, release, "0" * 64)
    assert not result.ok
    assert not haqengine.lib_path(local).exists()
    assert not haqengine.layer_manifest_path(local).exists()
    assert leftovers(data) == []


def test_failed_update_keeps_previous_files(tmp_path):
    local, _, _ = dirs(tmp_path)
    release, sha = make_release(tmp_path)
    assert install(tmp_path, release, sha).ok
    before = haqengine.layer_manifest_path(local).read_bytes()
    newer, _ = make_release(tmp_path, lib=b"ELF-v2", name="v2.tar.gz")
    assert not install(tmp_path, newer, "f" * 64).ok
    assert haqengine.lib_path(local).read_bytes() == b"ELF-v1"
    assert haqengine.layer_manifest_path(local).read_bytes() == before


def test_archive_without_library_is_refused(tmp_path):
    local, data, _ = dirs(tmp_path)
    release, sha = make_release(tmp_path, include_lib=False)
    result = install(tmp_path, release, sha)
    assert not result.ok
    assert "libhaqengine.so" in result.error
    assert not haqengine.layer_manifest_path(local).exists()
    assert leftovers(data) == []


def test_unsafe_archive_is_refused(tmp_path):
    local, data, _ = dirs(tmp_path)
    for kind in ("symlink", "escape"):
        release, sha = make_release(tmp_path, name=f"{kind}.tar.gz", **{kind: True})
        assert not install(tmp_path, release, sha).ok, kind
        assert not haqengine.lib_path(local).exists(), kind
        assert not (tmp_path / "evil").exists()
        assert leftovers(data) == []


def test_update_replaces_by_rename(tmp_path):
    local, data, _ = dirs(tmp_path)
    release, sha = make_release(tmp_path)
    assert install(tmp_path, release, sha).ok
    newer, newer_sha = make_release(tmp_path, lib=b"ELF-v2", name="v2.tar.gz")
    with open(haqengine.lib_path(local), "rb") as running:
        assert haqengine.install_haqengine(local, data, data / "manifest.json", fetcher(newer), URL, newer_sha, "0.2.0").ok
        assert running.read() == b"ELF-v1"
    assert haqengine.lib_path(local).read_bytes() == b"ELF-v2"
    assert haqengine.version_path(data).read_text().strip() == "0.2.0"


def test_adopts_handmade_haqengine_install(tmp_path):
    local, data, _ = dirs(tmp_path)
    lib = haqengine.lib_path(local)
    lib.parent.mkdir(parents=True)
    lib.write_bytes(b"handmade")
    manifest = haqengine.layer_manifest_path(local)
    manifest.parent.mkdir(parents=True)
    manifest.write_text(TEMPLATE.replace("@LIBRARY_PATH@", str(lib)))
    assert haqengine.engine_status(local, data, VERSION) == {
        "installed": True, "version": None, "pinned": VERSION, "update_available": True,
    }
    release, sha = make_release(tmp_path)
    assert install(tmp_path, release, sha).ok
    assert lib.read_bytes() == b"ELF-v1"
    assert haqengine.engine_status(local, data, VERSION)["update_available"] is False


def test_foreign_manifest_is_never_replaced_or_removed(tmp_path):
    local, data, _ = dirs(tmp_path)
    manifest = haqengine.layer_manifest_path(local)
    manifest.parent.mkdir(parents=True)
    foreign = b'{"layer": {"name": "VK_LAYER_OTHER"}}'
    manifest.write_bytes(foreign)
    release, sha = make_release(tmp_path)
    assert not install(tmp_path, release, sha).ok
    ok, reason = haqengine.remove_haqengine(local, data)
    assert ok is False and reason
    assert manifest.read_bytes() == foreign
    assert not haqengine.lib_path(local).exists()


def test_status_when_absent(tmp_path):
    local, data, _ = dirs(tmp_path)
    assert haqengine.engine_status(local, data, VERSION) == {
        "installed": False, "version": None, "pinned": VERSION, "update_available": False,
    }


def test_remove_deletes_both_files_and_version(tmp_path):
    local, data, _ = dirs(tmp_path)
    release, sha = make_release(tmp_path)
    assert install(tmp_path, release, sha).ok
    assert haqengine.remove_haqengine(local, data) == (True, None)
    assert not haqengine.lib_path(local).exists()
    assert not haqengine.layer_manifest_path(local).exists()
    assert not haqengine.version_path(data).exists()
    assert haqengine.engine_status(local, data, VERSION)["installed"] is False


def test_manifest_check_handles_missing_and_bad_files(tmp_path):
    assert haqengine.is_haqengine_manifest(tmp_path / "none.json") is False
    bad = tmp_path / "bad.json"
    bad.write_text("not json")
    assert haqengine.is_haqengine_manifest(bad) is False
    good = tmp_path / "good.json"
    good.write_text(TEMPLATE)
    assert haqengine.is_haqengine_manifest(good) is True
    assert isinstance(Path(good), Path)


def test_failed_manifest_removal_keeps_engine_retryable(tmp_path, monkeypatch):
    local, data, _ = dirs(tmp_path)
    release, sha = make_release(tmp_path)
    assert install(tmp_path, release, sha).ok
    manifest = haqengine.layer_manifest_path(local)
    real_unlink = Path.unlink

    def failing_unlink(self, *args, **kwargs):
        if self == manifest:
            raise PermissionError("read-only")
        return real_unlink(self, *args, **kwargs)

    monkeypatch.setattr(Path, "unlink", failing_unlink)
    ok, reason = haqengine.remove_haqengine(local, data)
    assert ok is False and reason
    assert haqengine.lib_path(local).exists()
    assert haqengine.engine_status(local, data, VERSION)["installed"] is True
