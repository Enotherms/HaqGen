from pathlib import Path

from haqgen.lsfg_cli import healthcheck, validate_config
from haqgen.run import RunResult


class Spy:
    def __init__(self):
        self.calls = []

    def __call__(self, cmd, timeout=15.0, env=None):
        self.calls.append((cmd, timeout, env))
        return RunResult(True, 0, "ok", "", False)


def test_validate_builds_expected_command():
    spy = Spy()
    validate_config(Path("/x/lsfg-vk-cli"), runner=spy)
    assert spy.calls[0][0] == ["/x/lsfg-vk-cli", "validate"]


def test_validate_sets_config_env_when_given():
    spy = Spy()
    validate_config(Path("/x/cli"), Path("/c/conf.toml"), runner=spy)
    assert spy.calls[0][2]["LSFGVK_CONFIG"] == "/c/conf.toml"


def test_healthcheck_builds_expected_command():
    spy = Spy()
    healthcheck(Path("/x/cli"), runner=spy)
    assert spy.calls[0][0] == ["/x/cli", "healthcheck"]
