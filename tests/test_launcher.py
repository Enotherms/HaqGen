import os
import subprocess
from pathlib import Path

import pytest

from haqgen.launcher import LAUNCHER_HEADER, install_launcher, launcher_path
from haqgen.manifest import load_manifest


def run_launcher(script: Path, home: Path, app_id: str | None) -> dict:
    env = {"HOME": str(home), "PATH": os.environ["PATH"]}
    if app_id is not None:
        env["SteamAppId"] = app_id
    out = subprocess.run(
        [str(script), "sh", "-c", 'printf "%s|%s" "${LSFGVK_PROFILE-}" "${DISABLE_LSFGVK-}"'],
        env=env, capture_output=True, text=True, timeout=10,
    )
    assert out.returncode == 0, out.stderr
    profile, disabled = out.stdout.split("|")
    return {"profile": profile, "disabled": disabled}


@pytest.fixture
def setup(tmp_path):
    home = tmp_path / "home"
    local = home / ".local"
    script = install_launcher(local, tmp_path / "m.json")
    games = home / ".config" / "haqgen" / "games"
    games.mkdir(parents=True)
    return home, script, games


def test_install_writes_executable_and_records_it(tmp_path):
    local = tmp_path / ".local"
    script = install_launcher(local, tmp_path / "m.json")
    assert script == launcher_path(local) == local / "bin" / "haqgen-launch"
    assert os.access(script, os.X_OK)
    assert LAUNCHER_HEADER in script.read_text()
    assert load_manifest(tmp_path / "m.json").paths == [str(script)]


def test_install_updates_own_script_without_duplicate_manifest(tmp_path):
    local = tmp_path / ".local"
    install_launcher(local, tmp_path / "m.json")
    install_launcher(local, tmp_path / "m.json")
    assert load_manifest(tmp_path / "m.json").paths == [str(local / "bin" / "haqgen-launch")]


def test_install_refuses_foreign_file(tmp_path):
    local = tmp_path / ".local"
    (local / "bin").mkdir(parents=True)
    (local / "bin" / "haqgen-launch").write_text("#!/bin/sh\necho someone else\n")
    with pytest.raises(FileExistsError):
        install_launcher(local, tmp_path / "m.json")
    assert "someone else" in (local / "bin" / "haqgen-launch").read_text()


def test_game_without_profile_uses_default(setup):
    home, script, games = setup
    assert run_launcher(script, home, "123") == {"profile": "HaqGen Default", "disabled": ""}


def test_game_with_own_profile(setup):
    home, script, games = setup
    (games / "123.profile").write_text("HaqGen 123 Some Game\n")
    assert run_launcher(script, home, "123") == {"profile": "HaqGen 123 Some Game", "disabled": ""}


def test_game_off(setup):
    home, script, games = setup
    (games / "123.profile").write_text("HaqGen 123 G")
    (games / "123.off").write_text("")
    assert run_launcher(script, home, "123")["disabled"] == "1"


def test_default_off_applies_only_to_games_without_profile(setup):
    home, script, games = setup
    (games / "default.off").write_text("")
    (games / "5.profile").write_text("HaqGen 5 Own")
    assert run_launcher(script, home, "9")["disabled"] == "1"
    assert run_launcher(script, home, "5") == {"profile": "HaqGen 5 Own", "disabled": ""}


def test_missing_app_id_uses_default(setup):
    home, script, games = setup
    assert run_launcher(script, home, None)["profile"] == "HaqGen Default"


def test_runs_the_game_command_with_arguments(setup):
    home, script, games = setup
    out = subprocess.run([str(script), "printf", "%s,%s", "a b", "c"], env={"HOME": str(home), "PATH": os.environ["PATH"]}, capture_output=True, text=True, timeout=10)
    assert out.stdout == "a b,c"
