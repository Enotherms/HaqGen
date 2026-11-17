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


def test_unknown_keys_are_dropped_because_lsfg_vk_rejects_them(tmp_path):
    path = tmp_path / "conf.toml"
    path.write_text(
        '[global]\ncurrent_profile = "x"\nlog_level = "debug"\n\n'
        '[[profile]]\nname = "A"\nactive_in = ["a"]\nfuture_key = 7\n',
        encoding="utf-8",
    )
    save_config(path, load_config(path))
    parsed = tomllib.loads(path.read_text(encoding="utf-8"))
    assert "current_profile" not in parsed["global"]
    assert parsed["global"]["log_level"] == "debug"
    assert "future_key" not in parsed["profile"][0]
    assert parsed["profile"][0]["name"] == "A"


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


def test_dump_starts_with_config_version_2():
    text = dump_config(Config())
    assert text.splitlines()[0] == "version = 2"
    assert tomllib.loads(text)["version"] == 2


def test_saved_config_keeps_version_2_and_log_settings(tmp_path):
    path = tmp_path / "conf.toml"
    path.write_text('[global]\nlog_level = "debug"\nlog_file = "/home/deck/lsfg-vk.log"\n', encoding="utf-8")
    save_config(path, load_config(path))
    parsed = tomllib.loads(path.read_text(encoding="utf-8"))
    assert parsed["version"] == 2
    assert parsed["global"]["log_level"] == "debug"
    assert parsed["global"]["log_file"] == "/home/deck/lsfg-vk.log"


def test_needs_upgrade(tmp_path):
    from haqgen.config import needs_upgrade

    p = tmp_path / "conf.toml"
    assert needs_upgrade(p) is False
    p.write_text("[global]\n", encoding="utf-8")
    assert needs_upgrade(p) is True
    p.write_text("version = 2\n[global]\n", encoding="utf-8")
    assert needs_upgrade(p) is False
    p.write_text("[[broken", encoding="utf-8")
    assert needs_upgrade(p) is False


def test_needs_upgrade_when_unknown_keys_present(tmp_path):
    from haqgen.config import needs_upgrade

    p = tmp_path / "conf.toml"
    p.write_text('version = 2\n[global]\ncurrent_profile = "x"\n', encoding="utf-8")
    assert needs_upgrade(p) is True
    p.write_text('version = 2\n[[profile]]\nname = "A"\nfuture = 1\n', encoding="utf-8")
    assert needs_upgrade(p) is True
    p.write_text('version = 2\n[global]\nlog_level = "debug"\n\n[[profile]]\nname = "A"\nmultiplier = 2\n', encoding="utf-8")
    assert needs_upgrade(p) is False
