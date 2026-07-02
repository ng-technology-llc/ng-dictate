# Decisions

- Plan starts in `planned` lifecycle and must be frozen before execution.
- 2026-07-02: Integration work must happen on `codex/integrate-upstream-0.9`, created from `product/main`, not directly on `product/main`.
- 2026-07-02: The first execution task must protect pre-existing dirty worktree changes before applying upstream integration changes.
- 2026-07-02: Prefer bounded integration slices over one blind `git merge` because upstream 0.9.0 overlaps product-line remote transcription, branding, release, and packaging files.
- 2026-07-02: Pre-existing WIP was parked in `stash@{0}` at `04bd10a943b917101f6d29ab9a593a59a83a0b05` before upstream integration. The stash contains only the nine dirty product files listed in `evidence/T-001-wip-stash.md`; loop state files remained unstashed for task completion.
- 2026-07-02: During `T-002`, keep `transcribe-rs` feature `whisper-cpp` temporarily alongside upstream `transcribe-cpp` scaffolding because current product code still imports `transcribe_rs::whisper_cpp`. `T-004` owns migrating those call sites and removing the temporary feature.
- 2026-07-02: `T-002` includes `bun.lock`, `.nix/bun.nix`, and `.nix/bun-lock-hash` even though the initial file hint focused on build scaffolding, because upstream's package dependency additions require lockfile and Nix dependency regeneration for reproducible installs.
- 2026-07-02: During `T-003`, keep a temporary `EngineType::Whisper` variant so the existing transcription pipeline compiles until `T-004` migrates it to transcribe-cpp. Also retain product `has_any_models_*` commands because current onboarding code still calls them.
- 2026-07-02: `T-003` temporarily routes `EngineType::TranscribeCpp` through the legacy Whisper loader only to keep staged integration compileable. This is not the final runtime behavior; `T-004` must replace it with native transcribe-cpp loading.
- 2026-07-02: `T-003` also updates `settings.rs` and `bindings.ts` outside the initial file hint because upstream model manager requires `onboarding_completed`, and frontend build requires the new `rescan_local_models` command wrapper.
- 2026-07-02: During `T-004`, make `TranscriptionManager::transcribe` the async routing boundary. `TranscriptionProvider::Local` runs the upstream native transcribe-cpp/ONNX path inside `spawn_blocking`; `TranscriptionProvider::Remote` keeps the product remote transcription client.
- 2026-07-02: Preserve upstream live streaming semantics in `actions.rs`: finalized stream text wins, empty/no stream falls back to the unified async transcription route, and finalize timeout is surfaced instead of starting a competing batch decode.
- 2026-07-02: Remove the temporary `EngineType::Whisper` variant and `transcribe-rs` `whisper-cpp` feature after migrating local Whisper-family models to `EngineType::TranscribeCpp`.
- 2026-07-02: Include upstream Rust overlay/audio manager utilities in `T-004` because the streaming recorder API, cancel-generation guard, and overlay enabled cache are required for the reconciled transcription pipeline to compile.
- 2026-07-02: During `T-005`, take upstream `src/` as the frontend base, then reapply product-line branding and remote transcription UI. Keep upstream catalog search, language filtering, live overlay, live logs, and What's New surfaces.
- 2026-07-02: Resolve locale files with a structured JSON deep merge: upstream translations are the base, product translations override shared keys and add remote-provider copy. `T-006` still owns final wording polish for docs/release/i18n.
- 2026-07-02: Keep product NG Dictate logos and repository links in sidebar, onboarding, about, and update checker while retaining upstream `ShowWhatsNewOnUpdate` and debug preview components.
