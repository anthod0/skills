FROM node:22-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git ripgrep \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global --ignore-scripts @earendil-works/pi-coding-agent@0.85.1 bun@1.4.0 \
    && cd /usr/local/lib/node_modules/bun && node install.js
WORKDIR /harness
COPY workspace.mjs pi-entry.mjs files.mjs auth.mjs agent-result.mjs ./
ENV PI_CODING_AGENT_DIR=/run/pi-agent PI_OFFLINE=1 PI_TELEMETRY=0
USER node
WORKDIR /workspace
ENTRYPOINT ["/usr/bin/timeout", "--signal=KILL"]
CMD ["180s", "node", "/harness/pi-entry.mjs"]

FROM base AS fixture
COPY --chown=node:node dependencies/ /opt/dependencies/
WORKDIR /opt/dependencies
RUN bun install --frozen-lockfile --ignore-scripts
WORKDIR /workspace
