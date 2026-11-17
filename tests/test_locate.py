from pathlib import Path

from haqgen.locate import default_steam_roots, find_dll, steam_library_paths


def make_dll(lib: Path, name: str = "lsfg-vk.dll") -> Path:
    d = lib / "steamapps" / "common" / "Lossless Scaling"
    d.mkdir(parents=True)
    f = d / name
    f.write_bytes(b"MZ")
    return f


def write_vdf(root: Path, *paths: Path) -> None:
    (root / "steamapps").mkdir(parents=True, exist_ok=True)
    body = "".join(f'\t"{i}"\n\t{{\n\t\t"path"\t\t"{p}"\n\t}}\n' for i, p in enumerate(paths))
    (root / "steamapps" / "libraryfolders.vdf").write_text(
        f'"libraryfolders"\n{{\n{body}}}\n', encoding="utf-8"
    )


def test_finds_dll_in_main_library(tmp_path):
    dll = make_dll(tmp_path)
    assert find_dll([tmp_path]) == dll


def test_finds_dll_in_second_library_from_vdf(tmp_path):
    main = tmp_path / "main"
    sd = tmp_path / "sdcard"
    main.mkdir()
    dll = make_dll(sd)
    write_vdf(main, main, sd)
    assert find_dll([main]) == dll


def test_returns_none_when_missing(tmp_path):
    assert find_dll([tmp_path]) is None
    assert find_dll([]) is None


def test_malformed_vdf_falls_back_to_root(tmp_path):
    (tmp_path / "steamapps").mkdir()
    (tmp_path / "steamapps" / "libraryfolders.vdf").write_text("{{{ nonsense", encoding="utf-8")
    assert steam_library_paths(tmp_path) == [tmp_path]
    dll = make_dll(tmp_path)
    assert find_dll([tmp_path]) == dll


def test_missing_vdf_falls_back_to_root(tmp_path):
    assert steam_library_paths(tmp_path) == [tmp_path]


def test_only_lsfg_vk_dll_counts(tmp_path):
    d = tmp_path / "steamapps" / "common" / "Lossless Scaling"
    d.mkdir(parents=True)
    (d / "Lossless.dll").write_bytes(b"MZ")
    assert find_dll([tmp_path]) is None
    (d / "lsfg-vk.dll").write_bytes(b"MZ")
    assert find_dll([tmp_path]).name == "lsfg-vk.dll"


def test_wrong_branch_detected_when_only_lossless_dll(tmp_path):
    from haqgen.locate import lossless_on_wrong_branch

    assert lossless_on_wrong_branch([tmp_path]) is False
    d = tmp_path / "steamapps" / "common" / "Lossless Scaling"
    d.mkdir(parents=True)
    (d / "Lossless.dll").write_bytes(b"MZ")
    assert lossless_on_wrong_branch([tmp_path]) is True
    (d / "lsfg-vk.dll").write_bytes(b"MZ")
    assert lossless_on_wrong_branch([tmp_path]) is False


def test_finds_dll_with_odd_case_folder(tmp_path):
    d = tmp_path / "steamapps" / "common" / "Lossless Scaling"
    d.mkdir(parents=True)
    (d / "lsfg-vk.dll").write_bytes(b"MZ")
    assert find_dll([tmp_path]) is not None


def test_default_steam_roots_are_under_home(tmp_path):
    roots = default_steam_roots(tmp_path)
    assert tmp_path / ".local" / "share" / "Steam" in roots
    assert tmp_path / ".steam" / "steam" in roots


def test_duplicate_library_paths_are_deduplicated(tmp_path):
    write_vdf(tmp_path, tmp_path, tmp_path)
    assert steam_library_paths(tmp_path).count(tmp_path) == 1
