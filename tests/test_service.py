import io
import tarfile
import tomllib
from pathlib import Path

import pytest

from haqgen import service
from haqgen.config import Config, Profile, load_config, save_config
from haqgen.manifest import load_manifest
from haqgen.service import Paths


@pytest.fixture
def paths(tmp_path):
    return Paths(
        config_path=tmp_path / "cfg" / "conf.toml",
        manifest_path=tmp_path / "data" / "manifest.json",
        data_dir=tmp_path / "data",
        steam_roots=[tmp_path / "steam"],
        log_path=tmp_path / "plugin.log",
        local_dir=tmp_path / "local",
    )


def add_dll(tmp_path):
    d = tmp_path / "steam" / "steamapps" / "common" / "Lossless Scaling"
    d.mkdir(parents=True)
    (d / "Lossless.dll").write_bytes(b"MZ")
    return d / "Lossless.dll"


LAYER = "share/vulkan/implicit_layer.d/VkLayer_LSFGVK_frame_generation.json"


def fake_fetch(url, dest):
    with tarfile.open(dest, "w:gz") as tar:
        for name, data in {
            "./bin/lsfg-vk-cli": b"#!/bin/sh\nexit 0\n",
            "./lib/liblsfg-vk-layer.so": b"so",
            "./" + LAYER: b"{}",
        }.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            info.mode = 0o755
            tar.addfile(info, io.BytesIO(data))


def test_launch_option_format():
    assert service.launch_option(42, "Game") == "LSFGVK_PROFILE='HaqGen 42 Game' %command%"


def test_launch_option_escapes_single_quote():
    out = service.launch_option(42, "Bob's Game")
    assert out == "LSFGVK_PROFILE='HaqGen 42 Bob'\\''s Game' %command%"


def test_get_state_without_dll(paths):
    s = service.get_state(paths)
    assert s["dll_found"] is False and s["installed"] is False
    assert s["profiles"] == [] and s["error"] is None


def test_setup_reports_missing_dll(paths):
    r = service.setup(paths, fetch=fake_fetch, url="u")
    assert r["ok"] is False and r["error"] == "dll_not_found"


def test_setup_installs_and_writes_dll_path(paths, tmp_path):
    dll = add_dll(tmp_path)
    r = service.setup(paths, fetch=fake_fetch, url="u")
    assert r["ok"] is True, r
    assert load_config(paths.config_path).dll == str(dll)
    assert load_manifest(paths.manifest_path).paths
    assert service.get_state(paths)["installed"] is True


def test_setup_without_url_says_so(paths, tmp_path):
    add_dll(tmp_path)
    r = service.setup(paths, fetch=None, url=None)
    assert r["ok"] is False and r["error"] == "install_url_unknown"


def test_save_profile_clamps_and_writes(paths):
    r = service.save_profile(
        paths, 7, "G", {"multiplier": 9, "flow_scale": 5.0, "performance_mode": True, "exe_names": ["g.exe"]}
    )
    assert r["ok"] is True
    p = load_config(paths.config_path).profiles[0]
    assert (p.name, p.multiplier, p.flow_scale, p.performance_mode, p.active_in) == (
        "HaqGen 7 G", 4, 1.0, True, ["g.exe"],
    )


def test_save_profile_applies_preset_then_overrides(paths):
    service.save_profile(paths, 7, "G", {"preset": "battery", "multiplier": 3})
    p = load_config(paths.config_path).profiles[0]
    assert (p.multiplier, p.flow_scale, p.performance_mode) == (3, 0.5, True)


def test_save_profile_unknown_preset_is_error_not_exception(paths):
    r = service.save_profile(paths, 7, "G", {"preset": "turbo"})
    assert r["ok"] is False


def test_save_profile_keeps_user_profiles(paths):
    save_config(paths.config_path, Config(profiles=[Profile(name="Mine", active_in=["mpv"])]))
    service.save_profile(paths, 7, "G", {"preset": "balanced"})
    names = [p.name for p in load_config(paths.config_path).profiles]
    assert names == ["Mine", "HaqGen 7 G"]


def test_get_profile_defaults_when_missing(paths):
    r = service.get_profile(paths, 7, "G")
    assert r["exists"] is False and r["multiplier"] == 2 and r["flow_scale"] == 0.75


def test_corrupt_config_returns_error_not_exception(paths):
    paths.config_path.parent.mkdir(parents=True)
    paths.config_path.write_text("[[profile\n", encoding="utf-8")
    assert service.get_state(paths)["error"]
    assert service.save_profile(paths, 7, "G", {})["ok"] is False
    assert paths.config_path.read_text(encoding="utf-8") == "[[profile\n"


def test_remove_all_requires_confirmed(paths, tmp_path):
    add_dll(tmp_path)
    service.setup(paths, fetch=fake_fetch, url="u")
    r = service.remove_all(paths, confirmed=False)
    assert r["ok"] is False and r["error"] == "not_confirmed"
    assert (paths.local_dir / "bin" / "lsfg-vk-cli").exists()


def test_removal_preview_lists_exact_paths(paths, tmp_path):
    add_dll(tmp_path)
    service.setup(paths, fetch=fake_fetch, url="u")
    service.save_profile(paths, 7, "G", {})
    pv = service.removal_preview(paths)
    assert sorted(pv["delete"]) == sorted(
        [
            str(paths.local_dir / "bin" / "lsfg-vk-cli"),
            str(paths.local_dir / "lib" / "liblsfg-vk-layer.so"),
            str(paths.local_dir / LAYER),
        ]
    )
    assert pv["profiles"] == ["HaqGen 7 G"]
    assert pv["refused"] == []


def test_remove_all_deletes_only_haqgen_things(paths, tmp_path):
    dll = add_dll(tmp_path)
    save_config(paths.config_path, Config(profiles=[Profile(name="Mine", active_in=["mpv"])]))
    service.setup(paths, fetch=fake_fetch, url="u")
    service.save_profile(paths, 7, "G", {})
    r = service.remove_all(paths, confirmed=True)
    assert r["ok"] is True
    assert not (paths.local_dir / "bin" / "lsfg-vk-cli").exists()
    assert dll.exists()
    assert [p.name for p in load_config(paths.config_path).profiles] == ["Mine"]
    assert load_manifest(paths.manifest_path).paths == []


def test_reset_defaults_only_touches_haqgen_profiles(paths):
    save_config(paths.config_path, Config(profiles=[Profile(name="Mine")]))
    service.save_profile(paths, 7, "G", {})
    r = service.reset_defaults(paths)
    assert r["ok"] is True
    assert [p.name for p in load_config(paths.config_path).profiles] == ["Mine"]


def test_read_log_returns_tail(paths):
    paths.log_path.write_text("\n".join(f"line{i}" for i in range(500)), encoding="utf-8")
    out = service.read_log(paths, max_lines=3)
    assert out.splitlines() == ["line497", "line498", "line499"]


def test_read_log_missing_file_is_empty(paths):
    assert service.read_log(paths) == ""


def test_delete_profile_removes_only_that_game(paths):
    save_config(paths.config_path, Config(profiles=[Profile(name="Mine")]))
    service.save_profile(paths, 7, "G", {})
    service.save_profile(paths, 8, "H", {})
    r = service.delete_profile(paths, 7, "G")
    assert r["ok"] is True
    assert [p.name for p in load_config(paths.config_path).profiles] == ["Mine", "HaqGen 8 H"]


def test_delete_profile_missing_is_ok(paths):
    assert service.delete_profile(paths, 7, "G")["ok"] is True


def test_setup_uses_existing_lsfg_vk_without_installing_or_claiming(paths, tmp_path):
    add_dll(tmp_path)
    for rel in ("bin/lsfg-vk-cli", "lib/liblsfg-vk-layer.so", LAYER):
        f = paths.local_dir / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text("other tool")
    r = service.setup(paths, fetch=None, url=None)
    assert r["ok"] is True, r
    assert load_manifest(paths.manifest_path).paths == []
    assert (paths.local_dir / "bin" / "lsfg-vk-cli").read_text() == "other tool"
    service.remove_all(paths, confirmed=True)
    assert (paths.local_dir / "bin" / "lsfg-vk-cli").read_text() == "other tool"


def test_setup_rejects_bad_checksum(paths, tmp_path):
    add_dll(tmp_path)
    r = service.setup(paths, fetch=fake_fetch, url="u", sha256="0" * 64)
    assert r["ok"] is False and r["error"] == "install_failed"
    assert not (paths.local_dir / "bin").exists()


def test_find_ca_bundle_picks_first_existing(tmp_path):
    a = tmp_path / "missing.pem"
    b = tmp_path / "b.pem"
    c = tmp_path / "c.pem"
    b.write_text("x")
    c.write_text("y")
    assert service.find_ca_bundle((a, b, c)) == str(b)


def test_find_ca_bundle_none_when_nothing_exists(tmp_path):
    assert service.find_ca_bundle((tmp_path / "nope.pem",)) is None


def test_download_verifies_tls_with_system_bundle(tmp_path, monkeypatch):
    import ssl
    import urllib.request

    bundle = tmp_path / "bundle.pem"
    bundle.write_text("x")
    seen = {}

    class Resp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    def fake_urlopen(url, timeout=None, context=None):
        seen["context"] = context
        return Resp(b"data")

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(service, "CA_BUNDLES", (bundle,))
    monkeypatch.setattr(ssl, "create_default_context", lambda cafile=None: ("ctx", cafile))
    dest = tmp_path / "out.bin"
    service.download("https://example.invalid/x", dest)
    assert dest.read_bytes() == b"data"
    assert seen["context"] == ("ctx", str(bundle))


def test_service_list_games(paths, tmp_path):
    d = tmp_path / "steam" / "steamapps"
    d.mkdir(parents=True)
    (d / "appmanifest_4.acf").write_text('"AppState"\n{\n"appid" "4"\n"name" "Four"\n}\n', encoding="utf-8")
    assert service.list_games(paths) == [{"app_id": 4, "name": "Four"}]


def _game(tmp_path, app_id=5, installdir="Five Dir"):
    d = tmp_path / "steam" / "steamapps"
    d.mkdir(parents=True, exist_ok=True)
    (d / f"appmanifest_{app_id}.acf").write_text(
        f'"AppState"\n{{\n"appid" "{app_id}"\n"name" "Five"\n"installdir" "{installdir}"\n}}\n',
        encoding="utf-8",
    )


def test_detect_process_returns_exe(paths, tmp_path):
    _game(tmp_path)
    p = tmp_path / "proc" / "42"
    p.mkdir(parents=True)
    (p / "cmdline").write_bytes(b"Z:\\x\\steamapps\\common\\Five Dir\\five.exe\0")
    r = service.detect_process(paths, 5, proc_root=tmp_path / "proc")
    assert r == {"ok": True, "exe": "five.exe"}


def test_detect_process_not_running(paths, tmp_path):
    _game(tmp_path)
    r = service.detect_process(paths, 5, proc_root=tmp_path / "proc")
    assert r == {"ok": False, "error": "not_running"}


def test_detect_process_game_not_found(paths, tmp_path):
    assert service.detect_process(paths, 99, proc_root=tmp_path)["error"] == "game_not_found"


def test_set_default_preset_rejects_unknown(paths):
    assert service.set_default_preset(paths, "turbo")["ok"] is False
    assert service.get_settings(paths)["default_preset"] == "balanced"


def test_new_profile_uses_default_preset(paths):
    assert service.set_default_preset(paths, "battery")["ok"] is True
    service.save_profile(paths, 7, "G", {})
    p = load_config(paths.config_path).profiles[0]
    assert (p.flow_scale, p.performance_mode) == (0.5, True)
    assert service.get_profile(paths, 8, "H")["preset"] == "battery"


def test_profile_dict_reports_matching_preset(paths):
    service.save_profile(paths, 7, "G", {"preset": "quality"})
    assert service.get_profile(paths, 7, "G")["preset"] == "quality"


def test_profile_dict_custom_is_none(paths):
    service.save_profile(paths, 7, "G", {"preset": "quality", "flow_scale": 0.4})
    assert service.get_profile(paths, 7, "G")["preset"] is None


def test_health_check_without_cli(paths):
    r = service.health_check(paths)
    assert r["ok"] is False and r["summary"] == "lsfg-vk is not installed."


def test_health_check_reports_output(paths, tmp_path):
    cli = tmp_path / "fakecli"
    cli.write_text('#!/bin/sh\necho "result for $1"\n', encoding="utf-8")
    cli.chmod(0o755)
    paths.cli_path = cli
    r = service.health_check(paths)
    assert r["ok"] is True
    assert "result for validate" in r["details"] and "result for healthcheck" in r["details"]
    assert r["summary"] == "Everything looks good."


def test_health_check_failure_summary(paths, tmp_path):
    cli = tmp_path / "badcli"
    cli.write_text('#!/bin/sh\necho "Unknown key" >&2\nexit 1\n', encoding="utf-8")
    cli.chmod(0o755)
    paths.cli_path = cli
    r = service.health_check(paths)
    assert r["ok"] is False and "Unknown key" in r["details"]
    assert r["summary"].startswith("lsfg-vk found a problem")


def test_preset_keeps_multiplier_and_still_matches(paths):
    service.save_profile(paths, 7, "G", {"multiplier": 3})
    service.save_profile(paths, 7, "G", {"preset": "quality"})
    r = service.get_profile(paths, 7, "G")
    assert (r["multiplier"], r["flow_scale"], r["preset"]) == (3, 1.0, "quality")
