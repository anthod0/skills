---
name: pontia-workflow
description: Pontia workflow：当用户要求创建或启动 workflow（例如“开一个 workflow”），或查看已有 workflow 进度时使用。这里的 workflow 是由 Pontia 编排的多阶段 Pi agent 任务，不是 GitHub Actions。
---

# Pontia workflow

Workflow 把用户目标拆成有序的 agent 节点。Pontia 为节点创建 Pi session，以 handoff 文件传递阶段成果；启动者负责规划和提交定义，具体工作由节点执行。

## 创建与启动

1. **确定目标与执行环境。** 从当前对话和项目文件提取目标、验收标准、工作目录与限制；只询问阻塞规划的缺失信息。运行 `command -v pontia` 和 `pontia workflow --help` 确认本机 CLI 可用。完成条件：工作目录存在，目标和验收标准明确，CLI 支持 `run` 与 `show`。不可用时报告阻塞，等待用户决定是否配置环境。

2. **设计交接。** 列出每个节点的职责、输入、输出和可检查的完成标准。下游 session 不继承当前对话，必须把所需背景写入 instructions 或初始 handoff；交接应包含结论、变更文件、验证结果及未解决事项，而不只是“已完成”。向用户展示阶段表并确认；用户已批准的计划可直接采用。完成条件：每项验收标准都有负责节点，每个输入有来源，执行计划已获批准。

3. **写定义并检查。** 按下面的格式，将 TOML 写入项目允许的本地规划目录中的新文件，使用绝对 `cwd`。逐节点检查必填字段、输入来源、输出名称及 instructions 中的完成标准。已有文件先读取，避免覆盖用户内容。完成条件：定义已落盘，所有字段符合下方约束，所有初始 handoff 源文件存在且为 UTF-8。这里只做静态检查；`run` 会实际启动执行，不是校验命令。

4. **启动一次并确认。** 用户要求启动且计划已批准后执行：
   ```bash
   pontia workflow run <definition-file>
   ```
   保存返回的 workflow ID，再执行 `pontia workflow show <workflow-id>`。完成条件：报告定义路径、ID 和查询到的当前状态；区分“已创建/正在运行”和“工作已完成”。启动超时或响应不明时报告不确定性，先核实是否已创建，避免盲目重试产生重复 workflow。

若用户只要求规划或生成定义，完成第 3 步即停止。

## 定义格式

```toml
title = "实现并验证一个功能"
cwd = "/absolute/path/to/project"

[[nodes]]
type = "agent"
phase = "实现"
title = "实现功能并验证"
instructions = """
目标：<具体功能与范围>。
验收：<可检查的行为与验证命令>。
在工作目录中实现功能并执行验证。
交接内容：变更摘要、相关文件、验证结果及遗留问题。
"""
output = "implementation.md"

[[nodes]]
type = "agent"
phase = "审查"
title = "审查实现与验收结果"
instructions = """
依据输入交接和实际代码，逐项核对：<具体验收标准>。
输出审查结论、验证证据，以及按严重程度列出的未解决问题。
"""
inputs = ["implementation.md"]
output = "review.md"
```

替换示例中的目标和验收占位符后再启动。

- 顶层字段为 `title`、`cwd`、可选 `handoffs`、`nodes`；至少一个节点。
- 节点必填 `type = "agent"`、非空 `phase`（最多 80 个字符）、非空 `title`、`instructions`、`output`；`inputs` 默认空。
- 节点按定义顺序编排；每个 input 必须来自初始 handoff 或前面节点的 output。`phase` 是展示标签，不是依赖或并行配置。
- input/output 是单个文件名，如 `review.md`，不是带目录的路径。为不同交接选择不同名称。
- 需要 execution profile 时，使用已确认存在的 `execution_profile_id` 和 `execution_profile_version`，两者一起填写；否则一起省略。
- CLI 拒绝未知字段；以上格式没有 `depends_on`、`parallel` 或任意节点类型。
- Pontia 自动把节点 instructions、输入 handoff 内容和输出提交命令放入节点首条任务。此处描述要交付什么即可。

需要把已有需求文件传给首个节点时，在首个 `[[nodes]]` 之前添加：

```toml
[[handoffs]]
name = "requirements.md"
source = "/absolute/path/to/requirements.md"
```

并在消费它的节点声明 `inputs = ["requirements.md"]`。`source` 和 `cwd` 的相对路径均相对于 TOML 文件所在目录，而不是启动 CLI 时的目录。

## 查看已有 workflow

从对话或上次启动结果取得 workflow ID，执行：

```bash
pontia workflow show <workflow-id>
```

仅在当前会话已有 `PONTIA_WORKFLOW_ID` 时才可省略 ID。依据返回结果汇报状态、进度、当前节点和失败原因；查不到时报告查询失败。查看进度不需要创建新 workflow。
