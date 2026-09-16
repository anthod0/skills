# Integration requirements

## Submission lifecycle

A conversation starts idle with no turns. Empty or whitespace-only questions are not sent. Only one request may be in flight: submissions while sending are ignored rather than queued. `send` resolves to true after a valid answer is recorded, or false for ignored or failed submissions.

Transport failures and invalid gateway responses expose an error and allow the same question to be retried. Failed attempts do not enter history or erase previous answers. Starting another request clears the previous error; a successful request returns to idle.

`getState` returns a snapshot for the host renderer. Editing that snapshot must not affect the live conversation. The retained-turn budget is a positive integer. Oldest complete question/answer pairs are evicted first so a retained answer never loses its question.

## Gateway messages

The gateway expects one nonempty system instruction, chronological user/assistant pairs from retained history, then the current user question. User text is transmitted unchanged, including whitespace and Unicode. Current and historical user input stay out of the system instruction. The support team maintains that instruction independently of conversation data.

Gateway answers must be nonempty strings; formatting is preserved for display. Missing or null citations mean no source links. A provided citation list must contain string titles and URLs; malformed answer or citation records are rejected with a TypeError. Unparseable URLs and schemes other than HTTP/HTTPS are discarded without losing the answer or valid links. Accepted URLs use standard URL serialization.

## Host rendering

The renderer consumes snapshots from this module. While sending, it exposes busy state and disables submission. An empty draft also disables submission. Errors are rendered as alerts and disappear after recovery. Transcript text and citation labels/attributes are escaped before insertion into HTML.

The renderer emits an `.assistant-panel` element for host theming. Its text color reads the public `--assistant-accent` custom property. Styling and user-facing wording are maintained by the design and support teams. The host attaches its own event handlers; the module does not mount DOM nodes or make network calls.
