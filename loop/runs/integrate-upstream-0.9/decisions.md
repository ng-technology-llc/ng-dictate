# Decisions

- Plan starts in `planned` lifecycle and must be frozen before execution.
- 2026-07-02: Integration work must happen on `codex/integrate-upstream-0.9`, created from `product/main`, not directly on `product/main`.
- 2026-07-02: The first execution task must protect pre-existing dirty worktree changes before applying upstream integration changes.
- 2026-07-02: Prefer bounded integration slices over one blind `git merge` because upstream 0.9.0 overlaps product-line remote transcription, branding, release, and packaging files.
- 2026-07-02: Pre-existing WIP was parked in `stash@{0}` at `04bd10a943b917101f6d29ab9a593a59a83a0b05` before upstream integration. The stash contains only the nine dirty product files listed in `evidence/T-001-wip-stash.md`; loop state files remained unstashed for task completion.
- 2026-07-02: During `T-002`, keep `transcribe-rs` feature `whisper-cpp` temporarily alongside upstream `transcribe-cpp` scaffolding because current product code still imports `transcribe_rs::whisper_cpp`. `T-004` owns migrating those call sites and removing the temporary feature.
- 2026-07-02: `T-002` includes `bun.lock`, `.nix/bun.nix`, and `.nix/bun-lock-hash` even though the initial file hint focused on build scaffolding, because upstream's package dependency additions require lockfile and Nix dependency regeneration for reproducible installs.
