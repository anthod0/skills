---
name: ui-debug
description: Iterate on a live UI, then finish with /implement after visual approval.
disable-model-invocation: true
---

# UI Debug Mode

A manually invoked **live iteration** mode: the user watches the page while the agent edits the UI directly. Stay in this mode across turns until the user explicitly approves the overall result or exits. Partial approval accompanied by further changes means iteration continues.

## Boundaries

- By invoking this skill, the user has authorized direct UI edits. No further confirmation is needed. Follow existing UI conventions for unspecified details.
- During iteration, do not invoke `/implement`, write tests, or write, run, or recommend test and validation commands, including typecheck, lint, and build. Use the user's live observations as feedback. Development-server process, port, and startup-log checks, along with operations necessary to start the server, are allowed.
- Limit edits to components, styles, presentation logic, local UI interaction state, and frontend routes and mocks needed for preview. Keep the backend, database, API contracts, and business rules unchanged; mock missing data as described below.

## 1. Prepare the development server

Read the project's startup instructions, scripts, and lockfile to identify the target frontend application and its development command. Check the relevant processes, ports, and logs. Reuse an existing server; otherwise, start one using the project's conventions and keep it running for the user. If another application occupies the port, choose an available port and leave that process intact.

**Complete when:** the target application's development server is ready and its actual URL is known. If startup is blocked, report the blocker rather than claiming the preview is available.

## 2. Implement a reachable UI

Apply the requested UI changes directly, using the existing component and styling systems.

- **Missing request data:** use available real data first. Supply minimal mocks for missing data at the UI boundary, keeping them centralized, clearly labeled, and limited to local preview while preserving the real request path. Simulated submissions update local state only, without writes to real systems.
- **Unmounted component:** follow existing routing conventions to add a temporary, development-only route that renders the target component with its required providers and layout. Reuse an accessible route when one already exists. Keep temporary entry points separate from normal application entry points.
- Track added mocks, temporary routes, and their files in the conversation for wrap-up.

**Complete when:** the current request is implemented and the component has a preview entry point. Give the user the full URL and a brief change summary. Disclose which data or interactions any new or changed mocks simulate, which real APIs or fields are missing, and which routes are temporary. Finished edits are not visual approval.

## 3. Continue iterating

For each further adjustment, repeat step 2 directly. Return to step 1 first if the server stops working. After each round, leave the server and preview entry point available and wait for feedback rather than initiating wrap-up.

**Complete when:** the user explicitly approves the overall result or asks to exit. If they exit without approval, report remaining mocks and temporary entry points, then stop without automatic wrap-up.

## 4. Wrap up after approval

Once the user explicitly approves the overall result, leave debug mode and read and execute [`/implement`](../implement/SKILL.md), using the approved UI requirements from the conversation as the scope. The iteration-only restrictions on tests and validation now end.

Clean up temporary entry points and include every mock and missing real-data integration in wrap-up. Remove preview scaffolding that is no longer needed while preserving the approved UI. If real integration requires changes beyond the UI, explain the gap and obtain scope authorization first; visual approval does not authorize backend implementation.

**Complete when:** `/implement` wrap-up is complete and every mock and temporary entry point has been addressed or explicitly reported as blocked. Do not claim full functional delivery while real-data integration gaps remain.
