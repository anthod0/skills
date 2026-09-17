Expand the tests for Replydesk's reply-generation flow and page. The current action tests replace the generator, and the page tests only exercise server-rendered states.

Cover the model adapter's handling of successful, empty, incomplete, and failed responses without making live API calls. Add interaction coverage for submitting a request, preventing duplicate submissions while waiting, retaining input after failure and retrying, and clipboard success and failure. Preserve the existing checks for input validation, message separation, and escaped draft content.

Keep product behavior unchanged. You may update `tests/`, test configuration in `vite.config.ts`, package dependencies and scripts with the corresponding lockfile, and the README's development notes as needed.

Run the relevant tests when finished, and summarize the coverage added and any validation you could not complete.
