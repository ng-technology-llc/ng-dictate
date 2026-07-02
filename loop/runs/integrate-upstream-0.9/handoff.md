# Handoff

## Read First
Read `loop/current.yaml`, then the active run's `context-index.md`.

## Current State
frozen

## Last Change
Completed `T-005`: upstream frontend settings, live overlay, language filtering, live logs, and What's New surfaces are integrated with NG Dictate branding and remote transcription UI. `bun run lint`, `bun run build`, and `cargo check` pass.

## Next Action
Continue with `T-006`: reconcile i18n wording, docs, release notes, and final verification.

## Do Not Do
Do not apply or drop the WIP stash unless the active task explicitly needs it and records the decision.
Do not treat stale frontend bindings/i18n as final until `T-005` and `T-006` regenerate and verify them.
