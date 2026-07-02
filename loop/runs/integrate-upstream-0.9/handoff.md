# Handoff

## Read First
Read `loop/current.yaml`, then the active run's `context-index.md`.

## Current State
frozen

## Last Change
Completed `T-003`: upstream catalog/model capability surfaces are integrated, product remote-provider onboarding is preserved, and `cargo check` plus `bun run build` pass.

## Next Action
Continue with `T-004`: reconcile transcription pipeline, remote transcription, CLI, and runtime language handling.

## Do Not Do
Do not apply or drop the WIP stash unless the active task explicitly needs it and records the decision.
Do not remove the temporary `transcribe-rs` `whisper-cpp` feature, `EngineType::Whisper`, or temporary `TranscribeCpp` legacy route before `T-004` migrates the remaining local transcription call sites.
