import sys
import time

from haqgen.run import run


def test_run_captures_output():
    r = run([sys.executable, "-c", "print('hi'); import sys; print('err', file=sys.stderr)"])
    assert r.ok and r.code == 0
    assert r.stdout.strip() == "hi"
    assert r.stderr.strip() == "err"
    assert r.timed_out is False


def test_run_nonzero_exit_is_not_ok():
    r = run([sys.executable, "-c", "raise SystemExit(3)"])
    assert not r.ok and r.code == 3


def test_run_times_out_and_kills():
    start = time.monotonic()
    r = run([sys.executable, "-c", "import time; time.sleep(5)"], timeout=0.3)
    assert time.monotonic() - start < 3
    assert r.timed_out is True and r.ok is False


def test_run_missing_binary_returns_not_ok():
    r = run(["/definitely/not/a/binary"])
    assert r.ok is False and r.code is None
    assert r.stderr


def test_run_passes_env():
    r = run([sys.executable, "-c", "import os; print(os.environ['HAQ_T'])"], env={"HAQ_T": "yes"})
    assert r.stdout.strip() == "yes"
