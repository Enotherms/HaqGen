from haqgen.settings import load_settings, save_settings


def test_settings_default_when_missing(tmp_path):
    assert load_settings(tmp_path / "s.json") == {"default_preset": "balanced"}


def test_settings_corrupt_falls_back(tmp_path):
    p = tmp_path / "s.json"
    p.write_text("{oops", encoding="utf-8")
    assert load_settings(p) == {"default_preset": "balanced"}
    p.write_text('["not a dict"]', encoding="utf-8")
    assert load_settings(p) == {"default_preset": "balanced"}


def test_settings_roundtrip_atomic(tmp_path):
    p = tmp_path / "dir" / "s.json"
    save_settings(p, {"default_preset": "quality"})
    assert load_settings(p) == {"default_preset": "quality"}
    assert not list(p.parent.glob("*.tmp"))


def test_settings_unknown_preset_value_falls_back(tmp_path):
    p = tmp_path / "s.json"
    p.write_text('{"default_preset": "turbo"}', encoding="utf-8")
    assert load_settings(p)["default_preset"] == "balanced"
