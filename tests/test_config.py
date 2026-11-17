import os
import tomllib
from pathlib import Path

import pytest

from haqgen.config import (
    Config,
    ConfigError,
    Profile,
    dump_config,
    load_config,
    save_config,
)


def test_missing_file_returns_empty_config(tmp_path):
    cfg = load_config(tmp_path / "nope.toml")
    assert cfg.profiles == []
    assert cfg.dll is None
    assert cfg.allow_fp16 is True


def test_roundtrip_preserves_values(tmp_path):
    cfg = Config(
        dll="/home/deck/Lossless.dll",
        allow_fp16=False,
        profiles=[
            Profile(
                name="Game",
                active_in=["game.exe", "Other"],
                multiplier=3,
                flow_scale=0.75,
                performance_mode=True,
            )
        ],
    )
    parsed = tomllib.loads(dump_config(cfg))
    assert parsed["global"]["dll"] == "/home/deck/Lossless.dll"
    assert parsed["global"]["allow_fp16"] is False
    p = parsed["profile"][0]
    assert p["name"] == "Game"
    assert p["active_in"] == ["game.exe", "Other"]
    assert p["multiplier"] == 3
    assert p["flow_scale"] == 0.75
    assert p["performance_mode"] is True
    assert p["pacing"] == "vsync"

    path = tmp_path / "conf.toml"
    save_config(path, cfg)
    again = load_config(path)
    assert again.profiles[0].name == "Game"
    assert again.profiles[0].multiplier == 3
    assert again.dll == "/home/deck/Lossless.dll"


def test_escapes_quotes_and_unicode_in_names():
    name = 'Pokémon "Red" ]\\ \n tab\t'
    cfg = Config(profiles=[Profile(name=name, active_in=[name])])
    parsed = tomllib.loads(dump_config(cfg))
    assert parsed["profile"][0]["name"] == name
    assert parsed["profile"][0]["active_in"] == [name]


def test_unknown_keys_preserved(tmp_path):
    path = tmp_path / "conf.toml"
    path.write_text(
        '[global]\nfuture_global = "x"\n\n'
        '[[profile]]\nname = "A"\nactive_in = ["a"]\nfuture_key = 7\n',
        encoding="utf-8",
    )
    cfg = load_config(path)
    save_config(path, cfg)
    parsed = tomllib.loads(path.read_text(encoding="utf-8"))
    assert parsed["global"]["future_global"] == "x"
    assert parsed["profile"][0]["future_key"] == 7


def test_user_profiles_untouched(tmp_path):
    path = tmp_path / "conf.toml"
    path.write_text(
        '[[profile]]\nname = "Mine"\nactive_in = ["mpv"]\nmultiplier = 4\n'
        "flow_scale = 0.5\n",
        encoding="utf-8",
    )
    cfg = load_config(path)
    cfg.profiles.append(Profile(name="HaqGen 1 Other", active_in=[]))
    save_config(path, cfg)
    again = load_config(path)
    mine = [p for p in again.profiles if p.name == "Mine"][0]
    assert (mine.active_in, mine.multiplier, mine.flow_scale) == (["mpv"], 4, 0.5)
    assert len(again.profiles) == 2


def test_corrupt_toml_raises_config_error_and_keeps_file(tmp_path):
    path = tmp_path / "conf.toml"
    path.write_text("[[profile\nname = ", encoding="utf-8")
    with pytest.raises(ConfigError):
        load_config(path)
    assert path.read_text(encoding="utf-8") == "[[profile\nname = "


def test_save_is_atomic_and_makes_backup(tmp_path):
    path = tmp_path / "conf.toml"
    path.write_text("# old\n", encoding="utf-8")
    save_config(path, Config(profiles=[Profile(name="N", active_in=[])]))
    assert (tmp_path / "conf.toml.haqgen.bak").read_text(encoding="utf-8") == "# old\n"
    assert not list(tmp_path.glob("*.tmp"))
    assert "N" in path.read_text(encoding="utf-8")


def test_save_failure_leaves_original(tmp_path, monkeypatch):
    path = tmp_path / "conf.toml"
    path.write_text("# keep\n", encoding="utf-8")

    def boom(src, dst):
        raise OSError("disk gone")

    monkeypatch.setattr(os, "replace", boom)
    with pytest.raises(OSError):
        save_config(path, Config())
    assert path.read_text(encoding="utf-8") == "# keep\n"
    assert not list(tmp_path.glob("*.tmp"))


def test_save_creates_parent_directory(tmp_path):
    path = tmp_path / "a" / "b" / "conf.toml"
    save_config(path, Config())
    assert path.exists()


def test_backup_keeps_first_original_across_saves(tmp_path):
    path = tmp_path / "conf.toml"
    path.write_text("# user original\n", encoding="utf-8")
    save_config(path, Config(profiles=[Profile(name="One", active_in=[])]))
    save_config(path, Config(profiles=[Profile(name="Two", active_in=[])]))
    bak = tmp_path / "conf.toml.haqgen.bak"
    assert bak.read_text(encoding="utf-8") == "# user original\n"
    assert "Two" in path.read_text(encoding="utf-8")


def test_wrong_value_type_raises_config_error(tmp_path):
    path = tmp_path / "conf.toml"
    path.write_text('[[profile]]\nname = "A"\nmultiplier = "lots"\n', encoding="utf-8")
    with pytest.raises(ConfigError):
        load_config(path)
