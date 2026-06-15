# Production DMG Release Plan

This plan prepares NG Dictate for production macOS DMG release with Apple Developer ID signing, notarization, and Tauri updater signing.

## Current State

- Product repository: `ng-technology-llc/ng-dictate`
- Product branch: `product/main`
- GitHub default branch: `product/main`
- Apple team: `ng technology llc`
- Apple Team ID: `5QSSU83XFK`
- Developer ID Application certificate: consolidated under ignored local release materials
- GitHub Actions Secrets: configured for Apple signing, Apple notarization, CI keychain, and Tauri updater signing
- App icon: replaced with NG Dictate generated artwork
- Tauri updater production key: generated locally and configured in `src-tauri/tauri.conf.json`

## Decisions

- Keep machine-local release credentials near the workspace under `local-release-materials/`.
- Ignore `local-release-materials/` entirely in git.
- Move release credentials into that directory instead of leaving duplicate copies scattered across the machine.
- Regenerate the Tauri updater key before the first production release.
- Commit only release procedure and public configuration changes; never commit private keys, passwords, `.p12`, base64 secret material, or generated local inventory containing sensitive values.

## Local Directory Layout

```text
local-release-materials/
  apple-developer-id/
    developer-id-application-20260614-221337/
      DeveloperIDG2CA.cer
      DeveloperIDG2CA.pem
  tauri-updater/
    production/
    legacy-dev-key/
  github-actions-secrets/
    inventory.md
```

## Phase 1: Consolidate Local Release Materials

Status: completed.

Move these existing files into `local-release-materials/apple-developer-id/developer-id-application-20260614-221337/`:

- `/Users/nic/.certs/ng-dictate/developer-id-application-20260614-221337/developer-id-application.csr`
- `/Users/nic/.certs/ng-dictate/developer-id-application-20260614-221337/developer-id-application.key`
- `/Users/nic/.certs/ng-dictate/developer-id-application-20260614-221337/developerID_application.cer`
- `/Users/nic/.certs/ng-dictate/developer-id-application-20260614-221337/developerID_application.pem`
- `/Users/nic/.certs/ng-dictate/developer-id-application-20260614-221337/developerID_application.p12`
- `/Users/nic/.certs/ng-dictate/developer-id-application-20260614-221337/developerID_application.p12.base64`
- `/Users/nic/.certs/ng-dictate/developer-id-application-20260614-221337/developerID_application.p12.password`
- `/Users/nic/Downloads/developerID_application.cer`, if still needed as the downloaded original

The CI `.p12` must be exported in a macOS `security import` compatible form and include Apple's Developer ID G2 intermediate certificate. Apple documents the Developer ID G2 intermediate on its PKI page; this local release material is stored as:

- `DeveloperIDG2CA.cer`
- `DeveloperIDG2CA.pem`

Move these existing Tauri updater files into `local-release-materials/tauri-updater/legacy-dev-key/`:

- `/Users/nic/.tauri/ng-dictate.key`
- `/Users/nic/.tauri/ng-dictate.key.pub`

After moving, set private-material permissions to owner-only:

```bash
chmod -R go-rwx local-release-materials
```

Verification:

```bash
git status --ignored -sb -- local-release-materials .gitignore CONTEXT.md docs/release/production-dmg-plan.md
```

Expected result: `local-release-materials/` appears ignored, not staged or tracked.

## Phase 2: Generate Production Tauri Updater Key

Status: completed.

Generate a new production updater key under:

```text
local-release-materials/tauri-updater/production/
```

Required outputs:

- Production private key
- Production public key
- Production key password stored locally

Then update:

```text
src-tauri/tauri.conf.json
```

Set `plugins.updater.pubkey` to the new production public key.

Verification:

```bash
jq -r '.plugins.updater.pubkey' src-tauri/tauri.conf.json
```

Expected result: the configured public key matches the production updater public key, not the legacy dev key.

## Phase 3: Prepare GitHub Actions Secrets

Status: completed. Apple certificate, Apple ID, Apple Team ID, Apple notarization app-specific password, CI keychain password, and production Tauri updater signing secrets are configured.

Configure repository secrets on `ng-technology-llc/ng-dictate`.

Required for Apple signing:

- `APPLE_CERTIFICATE`
  - Source: `developerID_application.p12.base64`
- `APPLE_CERTIFICATE_PASSWORD`
  - Source: `developerID_application.p12.password`
- `APPLE_TEAM_ID`
  - Value: `5QSSU83XFK`
- `KEYCHAIN_PASSWORD`
  - Source: generate a new random CI-only password

Required for Apple notarization:

- `APPLE_ID`
  - Source: Apple account email used for notarization
  - Status: configured
- `APPLE_PASSWORD`
  - Source: Apple app-specific password
- `APPLE_ID_PASSWORD`
  - Source: same Apple app-specific password, kept for workflow/tool compatibility

Required for Tauri updater signing:

- `TAURI_SIGNING_PRIVATE_KEY`
  - Source: production updater private key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - Source: production updater key password

Optional, not required for the current workflow:

- App Store Connect API key material
- Azure Windows signing secrets

Verification:

```bash
gh secret list -R ng-technology-llc/ng-dictate
bun run check:release
```

Expected result: all required secret names are present. Secret values are never printed.

## Phase 4: Replace Company Brand Assets

Status: completed.

Replace upstream Handy visual assets with NG Dictate assets before production release.

Replaced assets:

- `src-tauri/icons/icon.png`
- `src-tauri/icons/icon.icns`
- `src-tauri/icons/icon.ico`
- `src-tauri/icons/logo.png`
- `src-tauri/resources/tray_idle.png`
- `src-tauri/resources/tray_idle_dark.png`
- `src-tauri/resources/tray_recording.png`
- `src-tauri/resources/tray_recording_dark.png`
- `src-tauri/resources/tray_transcribing.png`
- `src-tauri/resources/tray_transcribing_dark.png`
- `src-tauri/resources/handy.png`
- `src-tauri/resources/recording.png`
- `src-tauri/resources/transcribing.png`
- `src/components/icons/NGDictateMark.tsx`
- `src/components/icons/NGDictateTextLogo.tsx`

The `handy.png` resource path remains for runtime compatibility with existing tray code, but its content is no longer upstream Handy artwork.

Verification:

```bash
bun run build
bun run lint
bun run check:translations
cargo check
```

## Phase 5: Commit Public Release Configuration

Commit only public repository changes:

- `.gitignore`
- `CONTEXT.md`
- `docs/release/production-dmg-plan.md`
- `src-tauri/tauri.conf.json`, if updater public key changes
- Brand asset changes, when ready

Do not commit:

- `local-release-materials/`
- `.p12`
- private keys
- passwords
- base64 secret values
- local inventory files containing sensitive values

## Phase 6: Run Release Workflow

Status: ready to run after the macOS DMG CI packaging path is validated.

Run the GitHub `Release` workflow from `product/main`.

Expected outputs:

- Draft GitHub release
- Signed macOS `.app`
- Signed/notarized macOS `.dmg`
- Tauri updater artifacts
- `latest.json`
- matching updater signatures

macOS DMG packaging note:

- The release workflow builds macOS `app` bundles first so Tauri still generates the updater archive and signature.
- The reusable build workflow then creates the DMG with `hdiutil` instead of Tauri's default Finder AppleScript DMG beautification path.
- The generated DMG is codesigned, submitted to Apple notarization, stapled, validated, and uploaded to the draft GitHub Release.

Verification:

```bash
bun run check:release
gh release list -R ng-technology-llc/ng-dictate --limit 5
gh run list -R ng-technology-llc/ng-dictate --workflow Release --limit 5
```

Expected release assets include at least two `.dmg` files, two `.app.tar.gz` updater archives, two `.app.tar.gz.sig` signatures, and `latest.json`.

If the release workflow fails, inspect the failing job logs before changing secrets or workflow configuration.

## Stop Conditions

Stop before proceeding if any of these are true:

- `local-release-materials/` is not ignored by git.
- A private key, `.p12`, password, or base64 secret appears in `git diff`.
- GitHub Secrets are missing required names.
- Apple notarization fails with an authentication error.
- The app still carries upstream Handy production iconography at release time.
