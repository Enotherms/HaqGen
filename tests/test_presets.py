import pytest

from haqgen.config import Config, Profile
from haqgen.presets import (
    PRESETS,
    apply_preset,
    clamp_settings,
    profile_name,
    remove_profile,
    upsert_profile,
)


def test_presets_values():
    assert PRESETS["battery"] == {"multiplier": 2, "flow_scale": 0.5, "performance_mode": True}
    assert PRESETS["balanced"] == {"multiplier": 2, "flow_scale": 0.75, "performance_mode": False}
    assert PRESETS["quality"] == {"multiplier": 2, "flow_scale": 1.0, "performance_mode": False}
    assert set(PRESETS) == {"battery", "balanced", "quality"}


def test_apply_preset_returns_new_profile():
    base = Profile(name="X", active_in=["x.exe"], multiplier=4)
    out = apply_preset(base, "battery")
    assert (out.multiplier, out.flow_scale, out.performance_mode) == (2, 0.5, True)
    assert out.active_in == ["x.exe"]
    assert base.multiplier == 4


def test_apply_unknown_preset_raises():
    with pytest.raises(ValueError):
        apply_preset(Profile(name="X"), "turbo")


def test_upsert_replaces_same_name():
    cfg = Config(profiles=[Profile(name="A", multiplier=2)])
    out = upsert_profile(cfg, Profile(name="A", multiplier=3))
    assert [p.multiplier for p in out.profiles] == [3]


def test_upsert_keeps_other_profiles():
    cfg = Config(profiles=[Profile(name="Mine", active_in=["mpv"])])
    out = upsert_profile(cfg, Profile(name="HaqGen 1 G"))
    assert [p.name for p in out.profiles] == ["Mine", "HaqGen 1 G"]
    assert out.profiles[0].active_in == ["mpv"]


def test_remove_profile_only_named():
    cfg = Config(profiles=[Profile(name="A"), Profile(name="B")])
    assert [p.name for p in remove_profile(cfg, "A").profiles] == ["B"]


def test_profile_name_basic():
    assert profile_name(1245620, "Elden Ring") == "HaqGen 1245620 Elden Ring"


def test_profile_name_handles_odd_characters():
    name = profile_name(7, "Bad\nName\t'quote'  \"dq\"")
    assert "\n" not in name and "\t" not in name
    assert name.startswith("HaqGen 7 ")
    assert "  " not in name


@pytest.mark.parametrize(
    "given,expected",
    [((9, 5.0), (4, 1.0)), ((0, 0.0), (2, 0.25)), ((3, 0.6), (3, 0.6))],
)
def test_clamp_settings_bounds(given, expected):
    assert clamp_settings(*given) == expected
