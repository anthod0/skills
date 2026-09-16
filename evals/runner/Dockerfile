FROM node:22-bookworm-slim
WORKDIR /harness
COPY container.mjs reporter.mjs plan.mjs ./
USER node
WORKDIR /workspace
ENTRYPOINT ["/usr/bin/timeout", "--signal=KILL", "25s", "node", "/harness/container.mjs"]
