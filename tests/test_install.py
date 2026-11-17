import hashlib
import io
import tarfile
from pathlib import Path

from haqgen.install import extract_archive, install_lsfg_vk, lsfg_present
from haqgen.manifest import load_manifest

FILES = {
    "./bin/lsfg-vk-cli": b"cli",
    "./lib/liblsfg-vk-layer.so": b"so",
    "./share/vulkan/implicit_layer.d/VkLayer_LSFGVK_frame_generation.json": b"{}",
}


def make_targz(dest: Path, files: dict[str, bytes]) -> None:
    with tarfile.open(dest, "w:gz") as tar:
        for name, data in files.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))


def fetcher(files):
    def fetch(url: str, dest: Path) -> None:
        make_targz(dest, files)

    return fetch


def test_install_records_created_files(tmp_path):
    local = tmp_path / "local"
    mp = tmp_path / "manifest.json"
    res = install_lsfg_vk(local, mp, fetcher(FILES), "u")
    assert res.ok, res.error
    assert (local / "bin" / "lsfg-vk-cli").read_bytes() == b"cli"
    assert sorted(load_manifest(mp).paths) == sorted(
        [
            str(local / "bin" / "lsfg-vk-cli"),
            str(local / "lib" / "liblsfg-vk-layer.so"),
            str(local / "share" / "vulkan" / "implicit_layer.d" / "VkLayer_LSFGVK_frame_generation.json"),
        ]
    )
    assert lsfg_present(local)


def test_install_does_not_claim_preexisting_files(tmp_path):
    local = tmp_path / "local"
    (local / "bin").mkdir(parents=True)
    (local / "bin" / "mine").write_text("user")
    mp = tmp_path / "manifest.json"
    res = install_lsfg_vk(local, mp, fetcher(FILES), "u")
    assert res.ok
    assert str(local / "bin" / "mine") not in load_manifest(mp).paths
    assert (local / "bin" / "mine").read_text() == "user"


def test_install_refuses_to_overwrite_existing_file(tmp_path):
    local = tmp_path / "local"
    (local / "bin").mkdir(parents=True)
    (local / "bin" / "lsfg-vk-cli").write_text("other tool")
    mp = tmp_path / "manifest.json"
    res = install_lsfg_vk(local, mp, fetcher(FILES), "u")
    assert not res.ok
    assert (local / "bin" / "lsfg-vk-cli").read_text() == "other tool"
    assert not (local / "lib").exists()
    assert load_manifest(mp).paths == []


def test_install_failure_cleans_partial_files(tmp_path):
    local = tmp_path / "local"
    mp = tmp_path / "manifest.json"

    def bad_fetch(url, path):
        path.write_bytes(b"this is not an archive")

    res = install_lsfg_vk(local, mp, bad_fetch, "u")
    assert not res.ok and res.error
    assert not any(p.is_file() for p in local.rglob("*"))
    assert load_manifest(mp).paths == []


def test_fetch_exception_returns_error(tmp_path):
    def boom(url, path):
        raise OSError("no network")

    res = install_lsfg_vk(tmp_path / "d", tmp_path / "m.json", boom, "u")
    assert not res.ok and "no network" in res.error


def test_sha256_mismatch_extracts_nothing(tmp_path):
    local = tmp_path / "local"
    res = install_lsfg_vk(local, tmp_path / "m.json", fetcher(FILES), "u", sha256="0" * 64)
    assert not res.ok and "checksum" in res.error.lower()
    assert not any(p.is_file() for p in local.rglob("*"))


def test_sha256_match_installs(tmp_path):
    blob = tmp_path / "blob.tar.gz"
    make_targz(blob, FILES)
    data = blob.read_bytes()

    def fetch(url, dest):
        dest.write_bytes(data)

    res = install_lsfg_vk(
        tmp_path / "local", tmp_path / "m.json", fetch, "u", sha256=hashlib.sha256(data).hexdigest()
    )
    assert res.ok, res.error


def test_download_goes_to_work_dir_and_is_removed(tmp_path):
    work = tmp_path / "work"
    seen = []

    def fetch(url, dest):
        seen.append(dest)
        make_targz(dest, FILES)

    res = install_lsfg_vk(tmp_path / "local", tmp_path / "m.json", fetch, "u", work_dir=work)
    assert res.ok
    assert seen[0].parent == work
    assert not list(work.iterdir())


def test_lsfg_present_false_when_incomplete(tmp_path):
    (tmp_path / "bin").mkdir()
    (tmp_path / "bin" / "lsfg-vk-cli").write_text("x")
    assert lsfg_present(tmp_path) is False


def test_extract_rejects_path_traversal(tmp_path):
    arc = tmp_path / "evil.tar.gz"
    make_targz(arc, {"../escape.txt": b"x"})
    dest = tmp_path / "out"
    dest.mkdir()
    try:
        extract_archive(arc, dest)
    except ValueError:
        pass
    else:
        raise AssertionError("expected ValueError")
    assert not (tmp_path / "escape.txt").exists()


def test_extract_works_when_tarfile_has_no_filter_support(tmp_path, monkeypatch):
    real = tarfile.TarFile.extractall

    def old_python(self, path=".", members=None, *, numeric_owner=False, **kw):
        if "filter" in kw:
            raise TypeError("extractall() got an unexpected keyword argument 'filter'")
        return real(self, path, members, numeric_owner=numeric_owner)

    monkeypatch.setattr(tarfile.TarFile, "extractall", old_python)
    res = install_lsfg_vk(tmp_path / "local", tmp_path / "m.json", fetcher(FILES), "u")
    assert res.ok, res.error
