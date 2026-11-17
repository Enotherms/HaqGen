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
    assert asyncio.run(p.launch_option(5, "G")) == "LSFGVK_PROFILE='HaqGen 5 G' %command%"


def test_remove_all_needs_confirmation(plugin_module):
    p = plugin_module.Plugin()
    assert asyncio.run(p.remove_all(False))["error"] == "not_confirmed"


def test_delete_profile_method(plugin_module):
    p = plugin_module.Plugin()
    assert asyncio.run(p.delete_profile(1, "G"))["ok"] is True
