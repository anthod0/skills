"""Generate repository/dependency build contexts from the pinned SWT specifications."""
import contextlib
import copy
import io
import json
import sys

sys.path.insert(0, "/opt/swt")


def environment(instance):
    from src.dataset import swe_to_swt_instance
    from src.exec_spec import make_exec_spec

    spec = make_exec_spec(swe_to_swt_instance(copy.deepcopy(instance)))
    spec.arch = "x86_64"
    return {"builds": [
        {"tag": spec.base_image_key, "files": {"Dockerfile": spec.base_dockerfile}},
        {"tag": spec.env_image_key, "files": {"Dockerfile": spec.env_dockerfile, "setup_env.sh": spec.env_script}},
        {"tag": spec.instance_image_key, "files": {"Dockerfile": spec.instance_dockerfile, "setup_repo.sh": spec.repo_script}},
    ]}


if __name__ == "__main__":
    request = json.load(sys.stdin)
    # Upstream helpers may print diagnostics while constructing the environment.
    with contextlib.redirect_stdout(io.StringIO()):
        result = environment(request["instance"])
    print(json.dumps(result))
