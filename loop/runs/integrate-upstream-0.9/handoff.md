# Handoff

## Read First
Read `loop/current.yaml`, then the active run's `context-index.md`.

## Current State
frozen

## Last Change
Completed `T-004`: transcription pipeline routing now keeps upstream native local transcription, live streaming finalize/fallback behavior, CLI compatibility, and product remote transcription together. `cargo check` passes.

## Next Action
Continue with `T-005`: integrate settings UI, overlay, language selector, live logs, and release notes surfaces.

## Do Not Do
Do not apply or drop the WIP stash unless the active task explicitly needs it and records the decision.
Do not treat stale frontend bindings/i18n as final until `T-005` and `T-006` regenerate and verify them.
