from pathlib import Path

from haqgen.locate import list_installed_games


def manifest(lib: Path, appid: int, name: str) -> None:
    d = lib / "steamapps"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"appmanifest_{appid}.acf").write_text(
        f'"AppState"\n{{\n\t"appid"\t\t"{appid}"\n\t"name"\t\t"{name}"\n\t"StateFlags"\t\t"4"\n}}\n',
        encoding="utf-8",
    )


def test_lists_games_sorted_by_name(tmp_path):
    manifest(tmp_path, 2, "Zelda")
    manifest(tmp_path, 1, "Alan Wake")
    games = list_installed_games([tmp_path])
    assert games == [{"app_id": 1, "name": "Alan Wake"}, {"app_id": 2, "name": "Zelda"}]


def test_finds_games_in_second_library(tmp_path):
    main = tmp_path / "main"
    sd = tmp_path / "sd"
    manifest(sd, 5, "Card Game")
    (main / "steamapps").mkdir(parents=True)
    (main / "steamapps" / "libraryfolders.vdf").write_text(
        f'"libraryfolders"\n{{\n"0"\n{{\n"path"\t\t"{main}"\n}}\n"1"\n{{\n"path"\t\t"{sd}"\n}}\n}}\n',
        encoding="utf-8",
    )
    assert list_installed_games([main]) == [{"app_id": 5, "name": "Card Game"}]


def test_skips_tools_and_lossless_scaling(tmp_path):
    manifest(tmp_path, 1493710, "Proton Experimental")
    manifest(tmp_path, 1628350, "Steam Linux Runtime 3.0 (sniper)")
    manifest(tmp_path, 228980, "Steamworks Common Redistributables")
    manifest(tmp_path, 993090, "Lossless Scaling")
    manifest(tmp_path, 7, "Real Game")
    assert list_installed_games([tmp_path]) == [{"app_id": 7, "name": "Real Game"}]


def test_handles_escaped_quotes_and_bad_files(tmp_path):
    manifest(tmp_path, 9, 'The \\"Quoted\\" One')
    (tmp_path / "steamapps" / "appmanifest_10.acf").write_text("{{{ junk", encoding="utf-8")
    (tmp_path / "steamapps" / "appmanifest_11.acf").write_bytes(b"\xff\xfe\x00bad")
    assert list_installed_games([tmp_path]) == [{"app_id": 9, "name": 'The "Quoted" One'}]


def test_no_libraries_returns_empty(tmp_path):
    assert list_installed_games([]) == []
    assert list_installed_games([tmp_path / "nothing"]) == []


def test_duplicate_app_in_two_roots_listed_once(tmp_path):
    manifest(tmp_path, 3, "Once")
    assert list_installed_games([tmp_path, tmp_path]) == [{"app_id": 3, "name": "Once"}]


def test_game_install_dir_from_manifest(tmp_path):
    d = tmp_path / "steamapps"
    d.mkdir()
    (d / "appmanifest_5.acf").write_text(
        '"AppState"\n{\n"appid" "5"\n"name" "Five"\n"installdir" "Five Dir"\n}\n', encoding="utf-8"
    )
    from haqgen.locate import game_install_dir

    assert game_install_dir([tmp_path], 5) == tmp_path / "steamapps" / "common" / "Five Dir"


def test_game_install_dir_missing(tmp_path):
    from haqgen.locate import game_install_dir

    assert game_install_dir([tmp_path], 5) is None
