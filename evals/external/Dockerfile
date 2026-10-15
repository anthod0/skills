FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git ripgrep python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global --ignore-scripts @earendil-works/pi-coding-agent@1.2.0
RUN git clone https://github.com/SWE-bench/SWE-bench /opt/swe \
    && git -C /opt/swe checkout --detach 02e7a74ffd0b707aab73d203fe87bdc7c76afc8e \
    && git clone https://github.com/logic-star-ai/swt-bench /opt/swt \
    && git -C /opt/swt checkout --detach 330a649a764fab2fadaea632776eeae87272f74b \
    && python3 -m venv /opt/harness-python \
    && /opt/harness-python/bin/pip install /opt/swe /opt/swt \
    && /opt/harness-python/bin/pip freeze > /opt/harness-requirements.txt
COPY runner/ /harness/
COPY external/adapter.py /harness/adapter.py
ENV PI_CODING_AGENT_DIR=/run/pi-agent PI_OFFLINE=1 PI_TELEMETRY=0
USER node
WORKDIR /workspace
ENTRYPOINT ["/usr/bin/timeout", "--signal=KILL"]
