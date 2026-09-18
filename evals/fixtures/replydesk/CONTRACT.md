# Replydesk behavior contract

The reply action rejects blank or over-limit customer messages, over-limit or non-text context, and unsupported tones before contacting the generator. It returns a draft with the submitted values on success. Provider failures expose a user-facing error, retain input, hide private diagnostics and permit retry.

Prompt construction preserves original customer text and known facts, including Unicode and whitespace, in a structured user message. System guidance is nonempty and independent of customer text and notes. Messages use distinct system/user roles. Guidance calls for grounded replies for human review, avoiding unconfirmed promises and invented facts.

The page provides a POST composer with a required customer message. Before a draft exists the copy action is unavailable. Returned drafts are rendered as text, never executable HTML. JavaScript adds pending-state feedback, duplicate-submission prevention, retained input after failure, retry and clipboard feedback.

The model adapter accepts complete, nonblank text replies and preserves their formatting. Empty or incomplete responses and provider failures are errors. Tests must not call a live provider.
