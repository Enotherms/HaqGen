import io
import tarfile
from pathlib import Path

from haqgen.install import extract_archive, install_lsfg_vk
from haqgen.manifest import load_manifest


def make_targz(dest: Path, files: dict[str, bytes]) -> None:
    with tarfile.open(dest, "w:gz") as tar:
        for name, data in files.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))


def fake_fetch_factory(files):
    def fetch(url: str, dest: Path) -> None:
        make_targz(dest, files)

    return fetch


def test_install_records_every_created_path(tmp_path):
    dest = tmp_path / "data"
    mp = tmp_path / "manifest.json"
    fetch = fake_fetch_factory({"lsfg-vk/lib/liblsfg.so": b"x", "lsfg-vk/bin/lsfg-vk-cli": b"y"})
    res = install_lsfg_vk(dest, mp, fetch, "https://example.invalid/a.tar.gz")
    assert res.ok, res.error
    assert (dest / "lsfg-vk" / "lib" / "liblsfg.so").exists()
    assert load_manifest(mp).paths == [str(dest / "lsfg-vk")]


def test_install_does_not_claim_preexisting_files(tmp_path):
    dest = tmp_path / "data"
    dest.mkdir()
    (dest / "mine.txt").write_text("user")
    mp = tmp_path / "manifest.json"
    res = install_lsfg_vk(dest, mp, fake_fetch_factory({"lsfg-vk/a": b"x"}), "u")
    assert res.ok
    assert str(dest / "mine.txt") not in load_manifest(mp).paths
    assert (dest / "mine.txt").read_text() == "user"


def test_install_refuses_to_overwrite_existing_file(tmp_path):
    dest = tmp_path / "data"
    (dest / "lsfg-vk").mkdir(parents=True)
    (dest / "lsfg-vk" / "a").write_text("original")
    mp = tmp_path / "manifest.json"
    res = install_lsfg_vk(dest, mp, fake_fetch_factory({"lsfg-vk/a": b"new"}), "u")
    assert not res.ok
    assert (dest / "lsfg-vk" / "a").read_text() == "original"
    assert load_manifest(mp).paths == []


def test_install_failure_cleans_partial_files(tmp_path):
    dest = tmp_path / "data"
    mp = tmp_path / "manifest.json"

    def bad_fetch(url, path):
        path.write_bytes(b"this is not an archive")

    res = install_lsfg_vk(dest, mp, bad_fetch, "u")
    assert not res.ok and res.error
    assert not list(dest.rglob("*")) or all(p.name != "lsfg-vk" for p in dest.iterdir())
    assert load_manifest(mp).paths == []


def test_fetch_exception_returns_error(tmp_path):
    def boom(url, path):
        raise OSError("no network")

    res = install_lsfg_vk(tmp_path / "d", tmp_path / "m.json", boom, "u")
    assert not res.ok and "no network" in res.error


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
