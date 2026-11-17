import asyncio
from pathlib import Path

import decky

from haqgen import service
from haqgen.locate import default_steam_roots

LSFG_VK_URL = None


def _paths() -> service.Paths:
    home = Path(decky.DECKY_USER_HOME)
    runtime = Path(decky.DECKY_PLUGIN_RUNTIME_DIR)
    return service.Paths(
        config_path=home / ".config" / "lsfg-vk" / "conf.toml",
        manifest_path=runtime / "manifest.json",
        data_dir=runtime,
        steam_roots=default_steam_roots(home),
        log_path=Path(decky.DECKY_PLUGIN_LOG),
    )


class Plugin:
    async def _main(self):
        decky.logger.info("HaqGen loaded")

    async def _unload(self):
        decky.logger.info("HaqGen unloaded")

    async def get_state(self) -> dict:
        return await asyncio.to_thread(service.get_state, _paths())

    async def setup(self) -> dict:
        return await asyncio.to_thread(
            service.setup, _paths(), service.download, LSFG_VK_URL
        )

    async def get_profile(self, app_id: int, game_name: str) -> dict:
        return await asyncio.to_thread(service.get_profile, _paths(), app_id, game_name)

    async def save_profile(self, app_id: int, game_name: str, settings: dict) -> dict:
        return await asyncio.to_thread(
            service.save_profile, _paths(), app_id, game_name, settings
        )

    async def launch_option(self, app_id: int, game_name: str) -> str:
        return service.launch_option(app_id, game_name)

    async def removal_preview(self) -> dict:
        return await asyncio.to_thread(service.removal_preview, _paths())

    async def remove_all(self, confirmed: bool) -> dict:
        return await asyncio.to_thread(service.remove_all, _paths(), confirmed)

    async def read_log(self, max_lines: int = 200) -> str:
        return await asyncio.to_thread(service.read_log, _paths(), max_lines)

    async def reset_defaults(self) -> dict:
        return await asyncio.to_thread(service.reset_defaults, _paths())
