from pathlib import Path

import pytest

from haqgen import flatpak as fp
from haqgen.run import RunResult


class FakeFlatpak:
    """Answers flatpak commands from a table and records every call."""

    def __init__(self, apps="", runtimes="", metadata=None, fail=()):
        self.apps, self.runtimes = apps, runtimes
        self.metadata = metadata or {}
        self.fail = set(fail)
        self.calls = []

    def __call__(self, cmd, timeout=30.0, env=None, inherit_env=True):
        self.calls.append(cmd)
        sub = cmd[1] if len(cmd) > 1 else ""
        if sub in self.fail:
            return RunResult(False, 1, "", f"{sub} failed", False)
        if sub == "--version":
            return RunResult(True, 0, "Flatpak 1.16.0\n", "", False)
        if sub == "list" and "--app" in cmd:
            return RunResult(True, 0, self.apps, "", False)
        if sub == "list" and "--runtime" in cmd:
            return RunResult(True, 0, self.runtimes, "", False)
        if sub == "info":
            return RunResult(True, 0, self.metadata.get(cmd[-1], ""), "", False)
        return RunResult(True, 0, "", "", False)


APPS = (
    "org.DolphinEmu.dolphin-emu\tDolphin\torg.kde.Platform/x86_64/6.8\n"
    "com.heroicgameslauncher.hgl\tHeroic Games Launcher\torg.freedesktop.Platform/x86_64/24.08\n"
    "io.old.App\tOld App\torg.freedesktop.Platform/x86_64/22.08\n"
)
KDE_META = "[Runtime]\nname=org.kde.Platform\n\n[Extension org.freedesktop.Platform.GL]\nversion=1.4\nversions=25.08;25.08-extra;1.4\n"


def test_available():
    assert fp.available(FakeFlatpak()) is True
    assert fp.available(FakeFlatpak(fail={"--version"})) is False


def test_list_apps_resolves_branches_including_kde_runtimes():
    run = FakeFlatpak(apps=APPS, metadata={"org.kde.Platform//6.8": KDE_META})
    apps = fp.list_apps(run)
    assert apps == [
        {"app_id": "org.DolphinEmu.dolphin-emu", "name": "Dolphin", "branch": "25.08", "supported": True},
        {"app_id": "com.heroicgameslauncher.hgl", "name": "Heroic Games Launcher", "branch": "24.08", "supported": True},
        {"app_id": "io.old.App", "name": "Old App", "branch": "22.08", "supported": False},
    ]


def test_list_apps_skips_malformed_lines():
    run = FakeFlatpak(apps="garbage\n\nbad id!\tX\torg.freedesktop.Platform/x86_64/24.08\n")
    assert fp.list_apps(run) == []


def test_installed_branches():
    run = FakeFlatpak(runtimes=f"{fp.EXTENSION_ID}\t24.08\norg.freedesktop.Platform\t24.08\n{fp.EXTENSION_ID}\t25.08\n")
    assert fp.installed_branches(run) == {"24.08", "25.08"}


def test_install_extension_uses_user_flathub_and_validates_branch():
    run = FakeFlatpak()
    assert fp.install_extension(run, "24.08").ok
    assert ["flatpak", "remote-add", "--user", "--if-not-exists", "flathub", fp.FLATHUB_URL] in run.calls
    assert ["flatpak", "install", "--user", "--noninteractive", "-y", "flathub", f"{fp.EXTENSION_ID}//24.08"] in run.calls
    with pytest.raises(ValueError):
        fp.install_extension(run, "24.08; rm -rf /")


@pytest.mark.parametrize("bad", ["", "abc", "a.b", "../evil.app.id", "org.x.y;rm", "org x.y.z", None, 5])
def test_app_id_validation(bad):
    with pytest.raises(ValueError):
        fp.valid_app_id(bad)


def test_enable_overrides_adds_only_missing_entries_and_keeps_user_ones(tmp_path):
    path = fp.override_path(tmp_path, "org.DolphinEmu.dolphin-emu")
    path.parent.mkdir(parents=True)
    path.write_text("[Context]\nfilesystems=/home/deck/Games:ro;\n\n[Environment]\nMY_VAR=1\n", encoding="utf-8")
    wanted = {"filesystems": ["/home/deck/.config/lsfg-vk:rw", "/home/deck/Games:ro"], "env": {"LSFGVK_CONFIG": "/c", "MY_VAR": "1"}}
    added = fp.enable_overrides(tmp_path, "org.DolphinEmu.dolphin-emu", wanted)
    assert added == {"filesystems": ["/home/deck/.config/lsfg-vk:rw"], "env": {"LSFGVK_CONFIG": "/c"}}
    text = path.read_text(encoding="utf-8")
    assert "filesystems=/home/deck/Games:ro;/home/deck/.config/lsfg-vk:rw;" in text
    assert "MY_VAR=1" in text and "LSFGVK_CONFIG=/c" in text


def test_disable_overrides_removes_only_what_haqgen_added(tmp_path):
    app = "org.DolphinEmu.dolphin-emu"
    path = fp.override_path(tmp_path, app)
    path.parent.mkdir(parents=True)
    path.write_text("[Context]\nfilesystems=/home/deck/Games:ro;\n\n[Environment]\nMY_VAR=1\n", encoding="utf-8")
    added = fp.enable_overrides(tmp_path, app, {"filesystems": ["/x:rw"], "env": {"LSFGVK_CONFIG": "/c"}})
    fp.disable_overrides(tmp_path, app, added)
    text = path.read_text(encoding="utf-8")
    assert "/home/deck/Games:ro" in text and "MY_VAR=1" in text
    assert "/x:rw" not in text and "LSFGVK_CONFIG" not in text


def test_disable_deletes_override_file_haqgen_created(tmp_path):
    app = "com.heroicgameslauncher.hgl"
    added = fp.enable_overrides(tmp_path, app, {"filesystems": ["/x:rw"], "env": {"A": "1"}})
    assert added["created"] is True
    fp.disable_overrides(tmp_path, app, added)
    assert not fp.override_path(tmp_path, app).exists()


def test_override_values_with_newlines_are_rejected(tmp_path):
    with pytest.raises(ValueError):
        fp.enable_overrides(tmp_path, "org.a.b", {"filesystems": [], "env": {"A": "1\n[Context]\nfilesystems=host"}})
    with pytest.raises(ValueError):
        fp.enable_overrides(tmp_path, "org.a.b", {"filesystems": ["/x;host"], "env": {}})


def test_clean_env_drops_library_overrides(monkeypatch):
    monkeypatch.setenv("LD_LIBRARY_PATH", "/decky/libs")
    monkeypatch.setenv("LD_PRELOAD", "/x.so")
    env = fp.clean_env("/home/deck")
    assert "LD_LIBRARY_PATH" not in env and "LD_PRELOAD" not in env
    assert env["HOME"] == "/home/deck"
