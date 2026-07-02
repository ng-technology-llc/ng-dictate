# NG Dictate

NG Dictate turns recorded speech into text and delivers that text to the user's current workflow. This glossary defines the product language used for speech capture, transcription, and related providers.

## Language

**Remote Transcription Provider**:
A transcription provider that accepts recorded audio from NG Dictate and returns transcript text from a separate service.
_Avoid_: Custom provider, post-processing provider, home server provider

**OpenAI-compatible Audio Transcription API**:
An audio transcription API that follows the OpenAI-style speech-to-text contract for submitting audio and receiving transcript text.
_Avoid_: arbitrary HTTP provider, custom JSON protocol

**Remote Transcription Model**:
The model identifier that NG Dictate asks a Remote Transcription Provider to use for a transcription request.
_Avoid_: local model, downloaded model

**Upstream Mirror**:
A branch that tracks the original Handy repository without company-specific product changes.
_Avoid_: mainline, product branch, vendor branch

**Product Line**:
The company's downstream product branch that combines selected upstream changes with company-owned features, branding, and release decisions.
_Avoid_: fork branch, custom main, downstream mirror

**Company Brand**:
The user-visible name, icon, bundle identity, website, update source, and release identity used for the company's downstream product.
_Avoid_: Handy brand, upstream brand, fork name

**Local Release Materials**:
Machine-local credentials and derived files used to prepare Company Brand releases. They are kept near the Product Line workspace for operator continuity but are not part of the repository.
_Avoid_: release assets, repo secrets, project files

**Project Playbook**:
Repository-local operating knowledge for AI assistants and maintainers to reuse when working on the Product Line. It records repeatable methods, decision checks, and known pitfalls without becoming product or contributor documentation.
_Avoid_: experience package, docs, loop log, runbook

**Playbook Capture**:
A manually requested workflow that distills a completed piece of work into Project Playbook entries. It may use task logs or Loop Harness reports as evidence, but it is not automatically triggered by them.
_Avoid_: automatic documentation, loop finalization, post-task logging
