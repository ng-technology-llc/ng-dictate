# Context Index

## Purpose
This file is the progressive-disclosure map for the active Loop Harness v2 run. It is an index only; do not treat it as a replacement for the structured state files.

## Entry Point
- Start at `loop/current.yaml`.
- Active run directory: `loop/runs/integrate-upstream-0.9/`.
- Then read this `context-index.md` before selecting or executing work.

## Source of Truth
- Active run files are the only source of truth for objective, scope, Requirements, Tasks, evidence, lifecycle, current work, and commit state.
- Conversation context, summaries, and Codex goal objectives are advisory only.
- If conversation context conflicts with active run files, follow the active run files.
- If a conflict affects P0/P1 scope, acceptance, risk, or authorization, stop and request replan.

## Rehydration Order
1. `loop/current.yaml`
2. `loop.yaml`
3. `state.json`
4. `requirements.json`
5. `residual-scope.json`
6. `tasks.jsonl`
7. `evals.yaml`
8. `progress.md`
9. `handoff.md`
10. `decisions.md`
11. `events.jsonl`
12. `commits.jsonl`
13. `worker-leases.jsonl`
14. current `git status --short` when git is available

## Where to Look
- Objective summary: `objective-brief.yaml` and `requirements.json` (Safely integrate upstream/main 0.9.0 capabilities into product/main without losing product-line behavior.)
- What to execute next: `state.json` and `tasks.jsonl`
- Done and remaining work: `requirements.json`, `tasks.jsonl`, and `progress.md`
- Current in-progress work: `state.json.current_task`
- Verification catalog: `evals.yaml`
- Verification evidence: `requirements.json`, `tasks.jsonl`, `task-logs/`, and `evidence/`
- Residual domain/MVP scope: `residual-scope.json` when the objective is domain-backed
- Checkpoint commits: `commits.jsonl` and git history
- Worker boundaries and cleanup: `worker-leases.jsonl`

## Do Not Use as Current State
- Root `loop/loop.yaml` is v1 and invalid.
- Chat history is not a source of truth.
- Old handoff documents outside this active run are advisory only.
