import asyncio
import threading
from pathlib import Path

import decky

from haqgen import service
from haqgen.locate import default_steam_roots

LSFG_VK_URL = "https://builds.lsfg-vk.dev/lsfg-vk-2.0.0.tar.xz"
LSFG_VK_SHA256 = "08bdbdf373a111022df87dac7aa87e3b564bb841f961552e3ca85fea12b5aa74"


_LOCK = threading.Lock()


async def _call(fn, *args):
    def locked():
        with _LOCK:
            return fn(*args)

    return await asyncio.to_thread(locked)


async def _read(fn, *args):
    """Read-only requests skip the lock so a slow Health check or Set up never blocks the panel."""
    return await asyncio.to_thread(fn, *args)


def _paths() -> service.Paths:
    home = Path(decky.DECKY_USER_HOME)
    runtime = Path(decky.DECKY_PLUGIN_RUNTIME_DIR)
    return service.Paths(
        config_path=home / ".config" / "lsfg-vk" / "conf.toml",
        manifest_path=runtime / "manifest.json",
        data_dir=runtime,
        steam_roots=default_steam_roots(home),
        local_dir=home / ".local",
        haqgen_dir=home / ".config" / "haqgen",
        log_path=Path(decky.DECKY_PLUGIN_LOG),
        settings_path=Path(decky.DECKY_PLUGIN_SETTINGS_DIR) / "settings.json",
    )


class Plugin:
    async def _main(self):
        decky.logger.info("HaqGen loaded")

    async def _unload(self):
        decky.logger.info("HaqGen unloaded")

    async def get_state(self) -> dict:
        return await _call(service.get_state, _paths())

    async def setup(self) -> dict:
        result = await _call(service.setup, _paths(), service.download, LSFG_VK_URL, LSFG_VK_SHA256)
        if not result.get("ok"):
            decky.logger.error("HaqGen setup failed: %s", result)
        return result

    async def list_games(self) -> list:
        return await _read(service.list_games, _paths())

    async def get_profile(self, app_id: int, game_name: str) -> dict:
        return await _read(service.get_profile, _paths(), app_id, game_name)

    async def save_profile(self, app_id: int, game_name: str, settings: dict) -> dict:
        return await _call(service.save_profile, _paths(), app_id, game_name, settings)

    async def delete_profile(self, app_id: int, game_name: str) -> dict:
        return await _call(service.delete_profile, _paths(), app_id, game_name)

    async def list_profiles(self) -> list:
        return await _read(service.list_profiles, _paths())

    async def launch_option(self) -> str:
        return service.launch_option()

    async def get_scope(self, app_id, game_name) -> dict:
        return await _read(service.get_scope, _paths(), app_id, game_name)

    async def save_default(self, settings: dict) -> dict:
        return await _call(service.save_default, _paths(), settings)

    async def set_gamescope_compat(self, app_id, on: bool) -> dict:
        return await _call(service.set_gamescope_compat, _paths(), app_id, on)

    async def set_fps_cap(self, app_id, cap) -> dict:
        return await _call(service.set_fps_cap, _paths(), app_id, cap)

    async def set_enabled(self, app_id, enabled: bool) -> dict:
        return await _call(service.set_enabled, _paths(), app_id, enabled)

    async def removal_preview(self) -> dict:
        return await _read(service.removal_preview, _paths())

    async def remove_all(self, confirmed: bool) -> dict:
        return await _call(service.remove_all, _paths(), confirmed)

    async def read_log(self, max_lines: int = 200) -> str:
        try:
            lines = max(1, min(2000, int(max_lines)))
        except (TypeError, ValueError):
            lines = 200
        return await _read(service.read_log, _paths(), lines)

    async def reset_lsfg_config(self) -> dict:
        return await _call(service.reset_lsfg_config, _paths())

    async def detect_process(self, app_id: int) -> dict:
        return await _read(service.detect_process, _paths(), app_id)

    async def get_settings(self) -> dict:
        return await _read(service.get_settings, _paths())

    async def set_default_preset(self, preset: str) -> dict:
        return await _call(service.set_default_preset, _paths(), preset)

    async def health_check(self) -> dict:
        return await _read(service.health_check, _paths())

    async def set_debug_log(self, on: bool) -> dict:
        return await _call(service.set_debug_log, _paths(), on)

    async def reset_defaults(self) -> dict:
        return await _call(service.reset_defaults, _paths())
