import os
from pathlib import Path

from haqgen.procs import find_game_exe


def proc(root: Path, pid: int, *args: str) -> None:
    d = root / str(pid)
    d.mkdir(parents=True)
    (d / "cmdline").write_bytes(b"\0".join(a.encode() for a in args) + b"\0")


GAME = Path("/home/deck/.local/share/Steam/steamapps/common/ELDEN RING")


def test_find_exe_windows_path(tmp_path):
    proc(tmp_path, 10, "/usr/bin/wine64-preloader", r"Z:\home\deck\.local\share\Steam\steamapps\common\ELDEN RING\Game\eldenring.exe")
    assert find_game_exe(GAME, tmp_path) == "eldenring.exe"


def test_find_exe_unix_path(tmp_path):
    proc(tmp_path, 11, "/home/deck/.local/share/Steam/steamapps/common/ELDEN RING/Game/start_protected_game.exe", "-x")
    assert find_game_exe(GAME, tmp_path) == "start_protected_game.exe"


def test_find_exe_uppercase_extension(tmp_path):
    proc(tmp_path, 12, r"C:\x\steamapps\common\ELDEN RING\GAME.EXE")
    assert find_game_exe(GAME, tmp_path) == "GAME.EXE"


def test_find_exe_ignores_other_games(tmp_path):
    proc(tmp_path, 5, r"Z:\steamapps\common\Other Game\other.exe")
    proc(tmp_path, 6, "/usr/bin/bash")
    assert find_game_exe(GAME, tmp_path) is None


def test_find_exe_lowest_pid_wins(tmp_path):
    proc(tmp_path, 300, r"Z:\a\steamapps\common\ELDEN RING\late.exe")
    proc(tmp_path, 20, r"Z:\a\steamapps\common\ELDEN RING\early.exe")
    assert find_game_exe(GAME, tmp_path) == "early.exe"


def test_find_exe_skips_unreadable_and_vanished(tmp_path):
    (tmp_path / "7").mkdir()
    bad = tmp_path / "8"
    bad.mkdir()
    (bad / "cmdline").mkdir()
    (tmp_path / "self").mkdir()
    proc(tmp_path, 9, r"Z:\s\steamapps\common\ELDEN RING\ok.exe")
    assert find_game_exe(GAME, tmp_path) == "ok.exe"


def test_find_exe_none_when_not_running(tmp_path):
    assert find_game_exe(GAME, tmp_path) is None
    assert find_game_exe(GAME, tmp_path / "missing") is None
