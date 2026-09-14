# Issue tracker: Local Markdown

Specs (also known as PRDs) for this repo live as markdown files in `.scratch/`. This is the fallback whenever no project instruction explicitly configures another tracker.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Comments and conversation history append to the bottom of the spec under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant spec"

Read the file at the referenced path. The user will normally pass the path directly.
