import os

from haqgen.manifest import (
    Manifest,
    execute_removal,
    load_manifest,
    plan_removal,
    record_paths,
)


def test_load_missing_returns_empty(tmp_path):
    m = load_manifest(tmp_path / "m.json")
    assert m.paths == [] and m.version == 1


def test_load_corrupt_returns_empty(tmp_path):
    p = tmp_path / "m.json"
    p.write_text("{not json", encoding="utf-8")
    assert load_manifest(p).paths == []


def test_record_paths_is_atomic_and_merges(tmp_path):
    mp = tmp_path / "m.json"
    record_paths(mp, [tmp_path / "a"])
    record_paths(mp, [tmp_path / "a", tmp_path / "b"])
    assert load_manifest(mp).paths == [str(tmp_path / "a"), str(tmp_path / "b")]
    assert not list(tmp_path.glob("*.tmp"))


def test_plan_refuses_dotdot(tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    outside = tmp_path / "keep.txt"
    outside.write_text("x")
    m = Manifest(paths=[str(root / ".." / "keep.txt")])
    plan = plan_removal(m, [root])
    assert plan.to_delete == [] and len(plan.refused) == 1


def test_plan_refuses_absolute_outside_roots(tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    other = tmp_path / "other.txt"
    other.write_text("x")
    plan = plan_removal(Manifest(paths=[str(other), "relative/path"]), [root])
    assert plan.to_delete == [] and len(plan.refused) == 2


def test_plan_refuses_symlink_escaping_root(tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    target = tmp_path / "precious"
    target.mkdir()
    (target / "f").write_text("x")
    link = root / "link"
    os.symlink(target, link)
    plan = plan_removal(Manifest(paths=[str(link), str(link / "f")]), [root])
    assert plan.to_delete == [] and len(plan.refused) == 2


def test_plan_refuses_the_root_itself(tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    plan = plan_removal(Manifest(paths=[str(root)]), [root])
    assert plan.to_delete == [] and len(plan.refused) == 1


def test_plan_skips_missing_paths(tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    plan = plan_removal(Manifest(paths=[str(root / "gone")]), [root])
    assert plan.to_delete == [] and plan.missing == [root / "gone"] and plan.refused == []


def test_execute_deletes_only_planned(tmp_path):
    root = tmp_path / "root"
    (root / "dir").mkdir(parents=True)
    (root / "dir" / "inner").write_text("x")
    (root / "file").write_text("x")
    (root / "unlisted").write_text("keep")
    plan = plan_removal(Manifest(paths=[str(root / "dir"), str(root / "file")]), [root])
    report = execute_removal(plan)
    assert not (root / "dir").exists() and not (root / "file").exists()
    assert (root / "unlisted").read_text() == "keep"
    assert len(report.deleted) == 2 and report.failed == []


def test_never_touches_dll_or_steam_dirs(tmp_path):
    root = tmp_path / "haqgen"
    root.mkdir()
    dll = tmp_path / "steam" / "steamapps" / "common" / "Lossless Scaling" / "Lossless.dll"
    dll.parent.mkdir(parents=True)
    dll.write_bytes(b"MZ")
    plan = plan_removal(Manifest(paths=[str(dll), str(dll.parent)]), [root])
    execute_removal(plan)
    assert dll.exists()
    assert len(plan.refused) == 2


def test_execute_rechecks_symlink_swapped_after_planning(tmp_path):
    root = tmp_path / "root"
    root.mkdir()
    victim = tmp_path / "victim"
    victim.mkdir()
    (victim / "f").write_text("x")
    item = root / "item"
    item.mkdir()
    plan = plan_removal(Manifest(paths=[str(item)]), [root])
    item.rmdir()
    os.symlink(victim, item)
    report = execute_removal(plan)
    assert (victim / "f").exists()
    assert report.deleted == []


def test_replace_manifest_overwrites_paths(tmp_path):
    from haqgen.manifest import replace_manifest

    mp = tmp_path / "m.json"
    record_paths(mp, [tmp_path / "a", tmp_path / "b"])
    replace_manifest(mp, [str(tmp_path / "b")])
    assert load_manifest(mp).paths == [str(tmp_path / "b")]
