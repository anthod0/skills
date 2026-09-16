# Assistant widget

An embeddable support conversation for order and account help. The host application supplies the model client and mounts the returned HTML; the widget owns request state, recent conversation history and source-link presentation.

```js
import { createAssistant } from './src/assistant.mjs';
import { renderWidget } from './src/widget.mjs';

const assistant = createAssistant({
  client: async ({ messages }) => supportGateway.ask({ messages }),
  maxTurns: 3,
});

await assistant.send('Where is my order?');
const html = renderWidget(assistant.getState(), '');
```

The client resolves to an object with an `answer` string and optional `citations` containing `title` and `url`. Reject the client promise for transport failures. The host wires its composer to `send` and renders again when the request starts and settles; rejected submissions leave the draft available for retry.

Host themes set `--assistant-accent` on the widget or an ancestor to change the panel's text color. Hosts that mount their own panel can import `widgetCss` from `src/widget.mjs`. See [the integration requirements](CONTRACT.md) for request lifecycle and gateway expectations.

## Development

Node.js 22+; no third-party dependencies. Run `node --test` from the repository root, or `node --test tests/assistant.test.mjs` for the submission flow. Tests use an injected client and inspect generated HTML without network access or a browser.
