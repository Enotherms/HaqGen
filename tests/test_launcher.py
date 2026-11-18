import os
import subprocess
from pathlib import Path

import pytest

from haqgen.launcher import LAUNCHER_HEADER, install_launcher, launcher_path
from haqgen.manifest import load_manifest

PRINT = 'printf "%s|%s|%s|%s" "${LSFGVK_PROFILE-}" "${DISABLE_LSFGVK-}" "${ENABLE_GAMESCOPE_WSI-unset}" "${LSFGVK_CONFIG-}"'


def run_launcher(script: Path, home: Path, **env_extra) -> dict:
    env = {"HOME": str(home), "PATH": os.environ["PATH"], **env_extra}
    out = subprocess.run([str(script), "sh", "-c", PRINT], env=env, capture_output=True, text=True, timeout=10)
    assert out.returncode == 0, out.stderr
    profile, disabled, wsi, config = out.stdout.split("|")
    return {"profile": profile, "disabled": disabled, "wsi": wsi, "config": config}


@pytest.fixture
def setup(tmp_path):
    home = tmp_path / "home"
    script = install_launcher(home, tmp_path / "m.json")
    games = home / ".config" / "haqgen" / "games"
    games.mkdir(parents=True)
    return home, script, games


def test_install_writes_executable_in_home_and_records_it(tmp_path):
    home = tmp_path / "home"
    script = install_launcher(home, tmp_path / "m.json")
    assert script == launcher_path(home) == home / "haqgen"
    assert os.access(script, os.X_OK)
    assert LAUNCHER_HEADER in script.read_text()
    assert load_manifest(tmp_path / "m.json").paths == [str(script)]


def test_install_updates_own_script_without_duplicate_manifest(tmp_path):
    home = tmp_path / "home"
    install_launcher(home, tmp_path / "m.json")
    install_launcher(home, tmp_path / "m.json")
    assert load_manifest(tmp_path / "m.json").paths == [str(home / "haqgen")]


def test_install_refuses_foreign_file(tmp_path):
    home = tmp_path / "home"
    home.mkdir()
    (home / "haqgen").write_text("#!/bin/sh\necho someone else\n")
    with pytest.raises(FileExistsError):
        install_launcher(home, tmp_path / "m.json")
    assert "someone else" in (home / "haqgen").read_text()


def test_sets_config_path(setup):
    home, script, games = setup
    assert run_launcher(script, home, SteamAppId="1")["config"] == f"{home}/.config/lsfg-vk/conf.toml"


def test_game_without_profile_uses_default(setup):
    home, script, games = setup
    r = run_launcher(script, home, SteamAppId="123")
    assert (r["profile"], r["disabled"]) == ("HaqGen Default", "")


def test_game_with_own_profile(setup):
    home, script, games = setup
    (games / "123.profile").write_text("HaqGen 123 Some Game\n")
    assert run_launcher(script, home, SteamAppId="123")["profile"] == "HaqGen 123 Some Game"


def test_game_off(setup):
    home, script, games = setup
    (games / "123.profile").write_text("HaqGen 123 G")
    (games / "123.off").write_text("")
    assert run_launcher(script, home, SteamAppId="123")["disabled"] == "1"


def test_default_off_applies_only_to_games_without_profile(setup):
    home, script, games = setup
    (games / "default.off").write_text("")
    (games / "5.profile").write_text("HaqGen 5 Own")
    assert run_launcher(script, home, SteamAppId="9")["disabled"] == "1"
    assert run_launcher(script, home, SteamAppId="5")["profile"] == "HaqGen 5 Own"


@pytest.mark.parametrize(
    "env,expected",
    [
        ({"SteamAppId": "7"}, "HaqGen 7 Own"),
        ({"SteamAppId": "abc", "SteamGameId": "7"}, "HaqGen 7 Own"),
        ({"STEAM_COMPAT_APP_ID": "7"}, "HaqGen 7 Own"),
        ({"SteamAppId": "", "SteamGameId": "x1", "STEAM_COMPAT_APP_ID": "7"}, "HaqGen 7 Own"),
        ({}, "HaqGen Default"),
        ({"SteamAppId": "../7"}, "HaqGen Default"),
    ],
)
def test_app_id_sources_numeric_only(setup, env, expected):
    home, script, games = setup
    (games / "7.profile").write_text("HaqGen 7 Own")
    assert run_launcher(script, home, **env)["profile"] == expected


def test_gamescope_compat_on_by_default(setup):
    home, script, games = setup
    assert run_launcher(script, home, SteamAppId="9")["wsi"] == "0"


def test_gamescope_compat_can_be_turned_off_per_scope(setup):
    home, script, games = setup
    (games / "default.gamescope-wsi").write_text("")
    assert run_launcher(script, home, SteamAppId="9")["wsi"] == "unset"
    (games / "5.profile").write_text("HaqGen 5 Own")
    assert run_launcher(script, home, SteamAppId="5")["wsi"] == "0"
    (games / "5.gamescope-wsi").write_text("")
    assert run_launcher(script, home, SteamAppId="5")["wsi"] == "unset"


def test_runs_the_game_command_with_arguments(setup):
    home, script, games = setup
    out = subprocess.run([str(script), "printf", "%s,%s", "a b", "c"], env={"HOME": str(home), "PATH": os.environ["PATH"]}, capture_output=True, text=True, timeout=10)
    assert out.stdout == "a b,c"


def test_gamescope_compat_not_applied_when_frame_generation_is_off(setup):
    home, script, games = setup
    (games / "default.off").write_text("")
    r = run_launcher(script, home, SteamAppId="9")
    assert r["disabled"] == "1" and r["wsi"] == "unset"
    (games / "5.profile").write_text("HaqGen 5 Own")
    (games / "5.off").write_text("")
    r = run_launcher(script, home, SteamAppId="5")
    assert r["disabled"] == "1" and r["wsi"] == "unset"
