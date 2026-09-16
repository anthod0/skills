FROM node:22-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git ripgrep \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global --ignore-scripts @earendil-works/pi-coding-agent@0.85.1
WORKDIR /harness
COPY container.mjs reporter.mjs plan.mjs pi-entry.mjs files.mjs auth.mjs agent-result.mjs ./
ENV PI_CODING_AGENT_DIR=/run/pi-agent PI_OFFLINE=1 PI_TELEMETRY=0
USER node
WORKDIR /workspace
ENTRYPOINT ["/usr/bin/timeout", "--signal=KILL"]
CMD ["25s", "node", "/harness/container.mjs"]
