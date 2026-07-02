# Handoff

## Read First
Read `loop/current.yaml`, then the active run's `context-index.md`.

## Current State
frozen

## Last Change
Completed `T-002`: upstream transcribe-cpp build/package scaffolding is integrated and `cargo check` passes with a temporary legacy `transcribe-rs` feature.

## Next Action
Continue with `T-003`: integrate model catalog, GGUF probing, and model manager capabilities.

## Do Not Do
Do not apply or drop the WIP stash unless the active task explicitly needs it and records the decision.
Do not remove the temporary `transcribe-rs` `whisper-cpp` feature before `T-004` migrates the remaining legacy call sites.
