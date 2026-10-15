"""Use pinned upstream specification/grade functions; never execute task code here."""
import contextlib
import copy
import io
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, "/opt/swt")


def swt_instance(row):
    from src.dataset import swe_to_swt_instance
    return swe_to_swt_instance(copy.deepcopy(row))


def plan(request):
    row = request["instance"]
    if request["benchmark"] == "swe":
        from swebench.harness.utils import make_test_spec
        spec = make_test_spec(row)
        return {"image": spec.image, "stages": [{"name": "tests", "script": spec.eval_script.replace("\ngit show\n", "\ngit show --no-patch\n")}]}
    from src.exec_spec import make_exec_spec
    from src.utils import get_test_directives
    spec = make_exec_spec(swt_instance(row))
    spec.arch = "x86_64"
    builds = [
        {"tag": spec.base_image_key, "files": {"Dockerfile": spec.base_dockerfile}},
        {"tag": spec.env_image_key, "files": {"Dockerfile": spec.env_dockerfile, "setup_env.sh": spec.env_script}},
        {"tag": spec.instance_image_key, "files": {"Dockerfile": spec.instance_dockerfile, "setup_repo.sh": spec.repo_script}},
    ]
    patch = request.get("patch", row["test_patch"])
    if not patch.strip():
        raise ValueError("SWT requires a nonempty test patch")
    stages = []
    for name, test, code in zip(
        ["pred_pre", "pred_post", "gold_pre", "gold_post", "base_pre", "base_post"],
        [patch, patch, row["test_patch"], row["test_patch"], None, None],
        [None, row["patch"], None, row["patch"], None, row["patch"]],
    ):
        spec.test_directives = get_test_directives(patch if test is None else test, spec.repo)
        spec.patch_list = ([code] if code else []) + ([test] if test else [])
        # Coverage tracing writes /root/trace.py in upstream. Relocate only that
        # helper and the scratch pre-state patch for non-root, read-only execution.
        spec.compute_coverage = True
        script = spec.eval_script.replace("\ngit show\n", "\ngit show --no-patch\n").replace("/root/trace.py", "/harness/trace.py").replace("/root/pre_state.patch", "/testbed/pre_state.patch")
        stages.append({"name": name, "script": script})
    return {"image": spec.instance_image_key, "builds": builds, "stages": stages}


def grade(request):
    row = request["instance"]
    with tempfile.TemporaryDirectory(prefix="skill-grade-") as root:
        paths = []
        for index, log in enumerate(request["logs"]):
            path = Path(root) / f"{index}.txt"
            path.write_text(log)
            paths.append(str(path))
        if request["benchmark"] == "swe":
            from swebench.harness.utils import make_test_spec
            from swebench.harness.grading import get_eval_report
            prediction = {"instance_id": row["instance_id"], "model_patch": request["patch"]}
            return get_eval_report(make_test_spec(row), prediction, paths[0], True)
        from src.grading import get_logs_eval, get_coverage_eval, get_pred_report
        parsed = [get_logs_eval(path, row["repo"], "unit_test") for path in paths]
        if len(parsed) != 6:
            raise ValueError("SWT requires exactly six evaluation logs")
        return get_pred_report(
            row["instance_id"], parsed[0][1] and parsed[1][1], row["patch"],
            [result for result, _ in parsed], [get_coverage_eval(path) for path in paths], True,
        )


def metadata(_request):
    return {"python": sys.version, "dependencies": Path("/opt/harness-requirements.txt").read_text()}


def main():
    request = json.load(sys.stdin)
    # Upstream utilities sometimes print while preparing a specification.
    with contextlib.redirect_stdout(io.StringIO()):
        result = {"plan": plan, "grade": grade, "metadata": metadata}[request["action"]](request)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
