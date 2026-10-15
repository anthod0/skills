import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { docker } from "../runner/docker.mjs";
import { writeTree } from "../runner/files.mjs";

export async function runIsolated(
  image,
  command,
  payload,
  { signal, invoke = docker, network = "none" } = {},
) {
  const name = `skill-external-${randomUUID()}`;
  let execution;
  try {
    execution = await invoke(
      [
        "run",
        "--name",
        name,
        "--rm",
        "--interactive",
        "--init",
        "--pull=never",
        "--read-only",
        "--user=1000:1000",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--cpus=1",
        "--memory=4g",
        "--pids-limit=256",
        `--network=${network}`,
        "--tmpfs=/workspace:rw,nosuid,nodev,exec,uid=1000,gid=1000,mode=0700,size=2g",
        "--tmpfs=/testbed:rw,nosuid,nodev,exec,uid=1000,gid=1000,mode=0700,size=2g",
        "--tmpfs=/environment:rw,nosuid,nodev,exec,uid=1000,gid=1000,mode=0700,size=2g",
        "--tmpfs=/tmp:rw,nosuid,nodev,exec,mode=1777,size=128m",
        "--tmpfs=/run/pi-agent:rw,nosuid,nodev,noexec,uid=1000,gid=1000,mode=0700,size=16m",
        "--entrypoint=/usr/bin/timeout",
        image,
        "--signal=KILL",
        "600s",
        ...command,
      ],
      { input: JSON.stringify(payload), timeoutMs: 610_000, signal },
    );
  } finally {
    const cleanup = await invoke(["rm", "--force", name], { timeoutMs: 10_000 });
    if (cleanup.problem || (cleanup.code !== 0 && !cleanup.stderr.includes("No such container"))) {
      execution ??= { code: null, stdout: "", stderr: "" };
      execution.cleanupFailed = true;
      execution.problem = `Container cleanup failed: ${name}`;
    }
  }
  return execution;
}

export function decodeExecution(result) {
  if (result.cleanupFailed || result.problem || result.code !== 0)
    throw new Error(
      result.problem ??
        `External container failed (${result.code}): ${(result.stderr ?? "").slice(-4000)}`,
    );
  return JSON.parse(result.stdout);
}

export async function build(directory, files, { tag, signal, invoke = docker } = {}) {
  await mkdir(directory, { recursive: true });
  const context = join(directory, "context");
  await writeTree(context, files);
  const args = [
    "build",
    "--network=host",
    "--platform=linux/amd64",
    "--iidfile",
    join(directory, "image-id"),
  ];
  if (tag) args.push("--tag", tag);
  args.push(context);
  const result = await invoke(args, { timeoutMs: 1_800_000, signal });
  await writeFile(join(directory, "build.log"), result.stdout + result.stderr);
  if (result.problem || result.code !== 0)
    throw new Error(`Image build failed: ${directory}/build.log`);
  const image = (await readFile(join(directory, "image-id"), "utf8")).trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error("Invalid image ID");
  return image;
}

export async function resolveImage(tag, { signal, invoke = docker } = {}) {
  if (!/^[\w./-]+@sha256:[a-f0-9]{64}$/.test(tag))
    throw new Error("Expected immutable upstream image digest");
  // Reuse the exact digest locally; pull only when it is absent, never use latest.
  let inspect = await invoke(["image", "inspect", tag], { signal });
  if (!inspect.problem && inspect.code !== 0 && /No such image/.test(inspect.stderr)) {
    const pull = await invoke(["pull", "--platform=linux/amd64", tag], {
      timeoutMs: 1_800_000,
      signal,
    });
    if (pull.problem || pull.code !== 0)
      throw new Error(`Benchmark image pull failed: ${pull.stderr.slice(-2000)}`);
    inspect = await invoke(["image", "inspect", tag], { signal });
  }
  if (inspect.problem || inspect.code !== 0) throw new Error("Image inspection failed");
  const [metadata] = JSON.parse(inspect.stdout);
  if (!/^sha256:[a-f0-9]{64}$/.test(metadata.Id)) throw new Error("Invalid benchmark image ID");
  return { image: metadata.Id, digests: metadata.RepoDigests };
}

export async function pinBuildInput(image, { signal, invoke = docker } = {}) {
  if (!/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error("Invalid image ID");
  const name = `skill-external:${image.slice(7)}`;
  const result = await invoke(["tag", image, name], { signal });
  if (result.problem || result.code !== 0) throw new Error("Cannot tag immutable build input");
  return name;
}

export function benchmarkDockerfile(control, benchmark, base, isSwt) {
  if (
    ![control, benchmark].every((image) => /^sha256:[a-f0-9]{64}$/.test(image)) ||
    !/^[a-f0-9]{40}$/.test(base)
  )
    throw new Error("Invalid benchmark build arguments");
  return `FROM skill-external:${control.slice(7)} AS tools
FROM skill-external:${benchmark.slice(7)}
USER root
RUN test "$(git -C /testbed rev-parse HEAD)" = "${base}" \\
    && git -C /testbed clean -fd \\
    && git -C /testbed branch -f evaluation-base ${base} \\
    && cp -a /testbed /opt/benchmark \\
    && rm -rf /opt/benchmark/.git \\
    && git clone --no-checkout --depth=1 --single-branch --branch evaluation-base file:///testbed /opt/history \\
    && mv /opt/history/.git /opt/benchmark/.git \\
    && git -C /opt/benchmark remote remove origin \\
    && git -C /opt/benchmark reset --mixed ${base} \\
    && rm -rf /opt/history /testbed \\
    && mkdir /testbed \\
    && chown -R 1000:1000 /opt/benchmark
${isSwt ? "RUN /opt/miniconda3/bin/conda clean --all --yes && mv /opt/miniconda3 /opt/benchmark-env && ln -s /environment/miniconda3 /opt/miniconda3\nENV PATH=/opt/miniconda3/envs/testbed/bin:/opt/miniconda3/bin:/usr/local/bin:/usr/bin:/bin\n" : ""}COPY --from=tools /usr/local/bin/node /usr/local/bin/node
COPY --from=tools /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js /usr/local/bin/pi
COPY --from=tools /harness /harness/runner
COPY --from=tools /opt/swt/src/auxillary_src/trace.py /harness/trace.py
COPY agent-entry.mjs oracle-entry.mjs patch.mjs /harness/external/
ENV PI_CODING_AGENT_DIR=/run/pi-agent PI_OFFLINE=1 PI_TELEMETRY=0
USER 1000:1000
WORKDIR /testbed
ENTRYPOINT ["/usr/bin/timeout", "--signal=KILL"]
`;
}
