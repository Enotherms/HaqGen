import asyncio
import importlib
import logging
import sys
import types

import pytest


@pytest.fixture
def plugin_module(tmp_path, monkeypatch):
    fake = types.ModuleType("decky")
    fake.DECKY_USER_HOME = str(tmp_path / "home")
    fake.DECKY_PLUGIN_RUNTIME_DIR = str(tmp_path / "runtime")
    fake.DECKY_PLUGIN_LOG = str(tmp_path / "plugin.log")
    fake.DECKY_PLUGIN_SETTINGS_DIR = str(tmp_path / "settings")
    fake.logger = logging.getLogger("haqgen-test")
    monkeypatch.setitem(sys.modules, "decky", fake)
    sys.modules.pop("main", None)
    return importlib.import_module("main")


def test_unload_and_main_return_cleanly(plugin_module):
    p = plugin_module.Plugin()
    asyncio.run(p._main())
    asyncio.run(p._unload())


def test_get_state_runs_through_thread(plugin_module, tmp_path):
    p = plugin_module.Plugin()
    state = asyncio.run(p.get_state())
    assert state["installed"] is False and state["dll_found"] is False


def test_launch_option_method(plugin_module):
    p = plugin_module.Plugin()
    assert asyncio.run(p.launch_option()) == "~/haqgen %command%"


def test_scope_methods(plugin_module):
    p = plugin_module.Plugin()
    assert asyncio.run(p.get_scope(None, None))["scope"] == "default"
    assert asyncio.run(p.save_default({"multiplier": 3}))["ok"] is True
    assert asyncio.run(p.set_enabled(None, False))["ok"] is True


def test_remove_all_needs_confirmation(plugin_module):
    p = plugin_module.Plugin()
    assert asyncio.run(p.remove_all(False))["error"] == "not_confirmed"


def test_delete_profile_method(plugin_module):
    p = plugin_module.Plugin()
    assert asyncio.run(p.delete_profile(1, "G"))["ok"] is True


def test_setup_failure_is_logged_with_detail(plugin_module, tmp_path, caplog, monkeypatch):
    caplog.set_level(logging.ERROR, logger="haqgen-test")
    dll_dir = tmp_path / "steam" / "steamapps" / "common" / "Lossless Scaling"
    dll_dir.mkdir(parents=True)
    (dll_dir / "lsfg-vk.dll").write_bytes(b"MZ")

    def boom(url, dest):
        raise OSError("no network")

    monkeypatch.setattr(plugin_module.service, "download", boom)
    monkeypatch.setattr(
        plugin_module,
        "_paths",
        lambda: plugin_module.service.Paths(
        config_path=tmp_path / "cfg" / "conf.toml",
        manifest_path=tmp_path / "rt" / "m.json",
        data_dir=tmp_path / "rt",
        steam_roots=[tmp_path / "steam"],
        local_dir=tmp_path / "local",
        ),
    )
    result = asyncio.run(plugin_module.Plugin().setup())
    assert result["ok"] is False and result["error"] == "install_failed"
    assert "no network" in result["detail"]
    assert "no network" in caplog.text


def test_list_games_method(plugin_module):
    assert asyncio.run(plugin_module.Plugin().list_games()) == []


def test_new_methods_exist_and_run(plugin_module):
    p = plugin_module.Plugin()
    assert asyncio.run(p.get_settings())["default_preset"] == "balanced"
    assert asyncio.run(p.set_default_preset("quality"))["ok"] is True
    assert asyncio.run(p.health_check())["ok"] is False
    assert asyncio.run(p.detect_process(1))["ok"] is False


def test_list_profiles_method(plugin_module):
    assert asyncio.run(plugin_module.Plugin().list_profiles())[0]["label"] == "Default"


def test_gamescope_method(plugin_module):
    assert asyncio.run(plugin_module.Plugin().set_gamescope_compat(None, False))["ok"] is True


def test_debug_log_method(plugin_module):
    assert asyncio.run(plugin_module.Plugin().set_debug_log(False))["ok"] is True


def test_concurrent_saves_do_not_lose_changes(plugin_module, monkeypatch):
    import time

    real_save = plugin_module.service.save_config

    def slow_save(path, cfg):
        time.sleep(0.02)
        real_save(path, cfg)

    monkeypatch.setattr(plugin_module.service, "save_config", slow_save)
    p = plugin_module.Plugin()

    async def both():
        await asyncio.gather(p.save_default({"multiplier": 4}), p.save_default({"performance_mode": True}))

    asyncio.run(both())
    prof = asyncio.run(p.get_scope(None, None))["profile"]
    assert prof["multiplier"] == 4 and prof["performance_mode"] is True


def test_reset_lsfg_config_method(plugin_module):
    assert asyncio.run(plugin_module.Plugin().reset_lsfg_config())["ok"] is True


def test_read_log_line_count_is_clamped(plugin_module, monkeypatch):
    seen = {}
    monkeypatch.setattr(plugin_module.service, "read_log", lambda paths, n: seen.setdefault("n", n) and "")
    asyncio.run(plugin_module.Plugin().read_log(10**9))
    assert seen["n"] == 2000


def test_every_backend_method_goes_through_the_lock():
    import inspect
    import pathlib

    source = pathlib.Path(__file__).resolve().parent.parent.joinpath("main.py").read_text()
    body = source.split("class Plugin:", 1)[1]
    assert "asyncio.to_thread" not in body


def test_fps_cap_method(plugin_module):
    assert asyncio.run(plugin_module.Plugin().set_fps_cap(None, 30))["ok"] is True
