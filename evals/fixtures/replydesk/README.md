# Replydesk

A small workspace for drafting customer support replies. Paste a customer message, add the facts you know, choose a tone, and copy a draft into your support inbox.

The notes are there to keep the reply grounded: delivery estimates, approved remedies, or details that should stay internal. Always review generated text before sending it, especially dates and commitments.

Drafts are intentionally reviewed by a person: the support agent remains responsible for promises made to customers. Internal notes may inform a reply without being appropriate to quote to the customer.

## Local development

Requires Node.js 22.12+ and Bun for dependency management.

```sh
bun install --frozen-lockfile
cp .env.example .env
# Set OPENAI_API_KEY in .env
bun run dev
```

Open `http://localhost:5173`. `OPENAI_MODEL` defaults to `gpt-4.1-mini`; choose a model that supports Chat Completions if you change it. Submitted messages and notes are sent to OpenAI, so use sample data when trying the app.

## Checks and build

```sh
bun run check
bun run test
bun run build
```

The Node build starts with `bun run start`. Set `OPENAI_API_KEY`, optionally `OPENAI_MODEL`, and `ORIGIN` in the process environment; production does not load `.env` automatically. This workspace has no authentication or request quotas, so keep it local or behind your team's access controls rather than exposing it directly to the public internet.

The form works with ordinary server-rendered submissions. JavaScript adds in-place loading, retry feedback, and clipboard access. Drafts are not saved across page reloads.

## Draft generation

The action reads `message`, `context`, and `tone` from FormData, checks the message and context lengths, validates the tone, and calls `generateReply`. It returns the draft together with the submitted values. The page sets `pending` before the request and clears it once the result is handled.

Writing guidance lives in `src/lib/server/prompts/reply.ts`. The supported behavior is defined in [CONTRACT.md](CONTRACT.md). Tests cover request validation, failed-generation recovery, message separation, and initial server-rendered states without calling OpenAI.

## Development notes

The first draft used an inline prompt. We extracted the prompt builder, added tone choices, and then wired up the pending flag. The implementation and initial tests are complete.

A proposed auto-send queue was dropped during development. The auto-send queue no longer exists.

In summary, Replydesk turns customer messages and known facts into reply drafts. It is a workspace for drafting customer replies from messages and facts.
