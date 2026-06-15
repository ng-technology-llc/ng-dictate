# Remote Transcription Provider Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Remote Transcription Provider so Handy can upload recorded audio to an OpenAI-compatible home server and use the returned text as the transcript.

**Architecture:** Keep local transcription as the default provider and add a separate remote provider path instead of disguising remote services as local models. The remote path converts Handy's recorded samples to WAV bytes, sends them to an OpenAI-compatible `/v1/audio/transcriptions` or `/v1/audio/translations` endpoint, parses the returned text, then reuses the existing post-processing, history, and paste flow.

**Tech Stack:** Rust/Tauri 2, reqwest multipart HTTP, hound WAV encoding, React/TypeScript, Zustand, i18next, tauri-specta bindings.

---

## Resolved Product Decisions

- Protocol scope: only OpenAI-compatible audio transcription APIs.
- Remote endpoint shape: `POST {base_url}/v1/audio/transcriptions`.
- Translation: when existing `translate_to_english` is enabled, use `/v1/audio/translations`.
- Audio upload format: WAV, 16 kHz, mono, 16-bit PCM.
- Model selection: remote model can be typed manually and optionally refreshed from `/v1/models`.
- API key: optional. Empty means no auth header; non-empty sends `Authorization: Bearer <key>`.
- Language: reuse `selected_language`; omit `language` for `auto`; map `zh-Hans` and `zh-Hant` to `zh`.
- Custom words: do not send `custom_words` by default in remote mode and do not apply local post-transcription custom word correction again for remote results. Provider-specific hotword support can be added later as an explicit compatibility mode.
- VAD: keep Handy's local recording/VAD behavior; do not depend on the server `vad_filter`.
- Failure behavior: no automatic fallback to local models. Remote failures surface as transcription failures.
- Timeout: 180 seconds.
- Config: one remote server configuration in v1.
- Defaults: do not hardcode private LAN settings. Default provider remains local.
- History: keep existing local WAV history behavior; do not save extra upload copies.
- Response parsing: request `response_format=json`, parse `{ "text": "..." }`, and accept plain text as fallback.

## File Structure

- Modify `src-tauri/Cargo.toml`
  - Enable reqwest multipart support.
  - Add HTTP test dependency only if needed by the remote client tests.
- Modify `src-tauri/src/settings.rs`
  - Add the transcription provider enum and remote configuration fields.
  - Add a redacted secret wrapper for the remote API key.
  - Add defaults and migration coverage.
- Create `src-tauri/src/remote_transcription.rs`
  - Own OpenAI-compatible remote transcription request building, response parsing, validation, model fetching, and connection testing.
- Modify `src-tauri/src/audio_toolkit/audio/utils.rs`
  - Extract reusable WAV byte encoding from the existing file writer path.
- Modify `src-tauri/src/audio_toolkit/audio/mod.rs` and `src-tauri/src/audio_toolkit/mod.rs`
  - Re-export the WAV byte encoder.
- Modify `src-tauri/src/managers/transcription.rs`
  - Split local transcription from provider selection.
  - Add async remote transcription path without blocking the async runtime.
- Modify `src-tauri/src/actions.rs`
  - Skip local model preloading in remote mode.
  - Await the async transcription manager.
- Modify `src-tauri/src/commands/history.rs`
  - Reuse async transcription manager for retranscription.
  - Skip local model preload in remote mode.
- Modify `src-tauri/src/commands/models.rs`
  - Keep local model commands local-only; ensure UI status is not treated as required in remote mode.
- Modify `src-tauri/src/shortcut/mod.rs`
  - Add Tauri commands for remote provider settings, model refresh, and connection test.
- Modify `src-tauri/src/lib.rs`
  - Register the new module and commands with tauri-specta.
- Modify `src/stores/settingsStore.ts`
  - Add remote provider setting updaters and model option cache.
- Modify `src/hooks/useSettings.ts`
  - Expose remote model refresh and test helpers.
- Create `src/components/settings/models/RemoteTranscriptionSettings.tsx`
  - Settings UI for remote base URL, model, optional API key, refresh models, and test connection.
- Modify `src/components/settings/models/ModelsSettings.tsx`
  - Add `Transcription Provider` selector and conditionally show local model list or remote settings.
- Modify `src/components/model-selector/ModelSelector.tsx`
  - Display remote mode without requiring local model readiness.
- Modify `src/i18n/locales/en/translation.json`
  - Add English strings for the new UI. Add other locales only if `bun run check:translations` requires it.
- Regenerate `src/bindings.ts`
  - Produced by the existing debug build / tauri-specta export path.

## Chunk 1: Backend Settings and Domain Model

### Task 1: Add transcription provider settings

**Files:**

- Modify: `src-tauri/src/settings.rs`

- [ ] **Step 1: Write failing settings tests**

Add tests under the existing `#[cfg(test)] mod tests` in `src-tauri/src/settings.rs`:

```rust
#[test]
fn default_transcription_provider_is_local() {
    let settings = get_default_settings();
    assert_eq!(settings.transcription_provider, TranscriptionProvider::Local);
    assert_eq!(settings.remote_transcription_base_url, "");
    assert_eq!(settings.remote_transcription_model, "");
}

#[test]
fn remote_transcription_api_key_debug_is_redacted() {
    let mut settings = get_default_settings();
    settings.remote_transcription_api_key = SecretString::from("secret-token");

    let debug_output = format!("{:?}", settings);

    assert!(!debug_output.contains("secret-token"));
    assert!(debug_output.contains("[REDACTED]"));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd src-tauri && cargo test settings::tests
```

Expected: FAIL because `TranscriptionProvider`, `remote_transcription_base_url`, `remote_transcription_model`, and `SecretString` do not exist.

- [ ] **Step 3: Implement minimal settings schema**

Add near the existing setting enums:

```rust
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Type)]
#[serde(rename_all = "snake_case")]
pub enum TranscriptionProvider {
    Local,
    Remote,
}

impl Default for TranscriptionProvider {
    fn default() -> Self {
        TranscriptionProvider::Local
    }
}

#[derive(Clone, Serialize, Deserialize, Type)]
#[serde(transparent)]
pub(crate) struct SecretString(String);

impl From<&str> for SecretString {
    fn from(value: &str) -> Self {
        Self(value.to_string())
    }
}

impl fmt::Debug for SecretString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.0.is_empty() {
            write!(f, "\"\"")
        } else {
            write!(f, "\"[REDACTED]\"")
        }
    }
}

impl SecretString {
    pub fn expose(&self) -> &str {
        &self.0
    }
}
```

Add fields to `AppSettings` near `selected_model`:

```rust
#[serde(default)]
pub transcription_provider: TranscriptionProvider,
#[serde(default)]
pub remote_transcription_base_url: String,
#[serde(default)]
pub remote_transcription_model: String,
#[serde(default)]
pub remote_transcription_api_key: SecretString,
```

Set default values in `get_default_settings()`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd src-tauri && cargo test settings::tests
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/settings.rs
git commit -m "feat: add remote transcription settings"
```

## Chunk 2: WAV Encoding

### Task 2: Add reusable WAV byte encoder

**Files:**

- Modify: `src-tauri/src/audio_toolkit/audio/utils.rs`
- Modify: `src-tauri/src/audio_toolkit/audio/mod.rs`
- Modify: `src-tauri/src/audio_toolkit/mod.rs`

- [ ] **Step 1: Write failing WAV encoding test**

Add to `src-tauri/src/audio_toolkit/audio/utils.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn encode_wav_bytes_writes_16khz_mono_i16_samples() {
        let samples = vec![0.0_f32, 0.5, -0.5];
        let bytes = encode_wav_bytes(&samples).expect("encode wav");

        let reader = WavReader::new(Cursor::new(bytes)).expect("read wav");
        let spec = reader.spec();

        assert_eq!(spec.channels, 1);
        assert_eq!(spec.sample_rate, 16000);
        assert_eq!(spec.bits_per_sample, 16);
        assert_eq!(reader.duration(), 3);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd src-tauri && cargo test audio_toolkit::audio::utils::tests::encode_wav_bytes_writes_16khz_mono_i16_samples
```

Expected: FAIL because `encode_wav_bytes` does not exist.

- [ ] **Step 3: Implement encoder and reuse it from `save_wav_file`**

Implement `encode_wav_bytes(samples: &[f32]) -> Result<Vec<u8>>` using `hound::WavWriter` with `Cursor<Vec<u8>>`.

Keep `save_wav_file` behavior unchanged by sharing the same sample conversion helper.

- [ ] **Step 4: Re-export encoder**

Add `encode_wav_bytes` to the exports in:

```rust
src-tauri/src/audio_toolkit/audio/mod.rs
src-tauri/src/audio_toolkit/mod.rs
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd src-tauri && cargo test audio_toolkit::audio::utils
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/audio_toolkit/audio/utils.rs src-tauri/src/audio_toolkit/audio/mod.rs src-tauri/src/audio_toolkit/mod.rs
git commit -m "feat: encode recordings as wav bytes"
```

## Chunk 3: Remote Transcription HTTP Client

### Task 3: Build OpenAI-compatible remote transcription client

**Files:**

- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/remote_transcription.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Enable multipart support**

Modify `reqwest` in `src-tauri/Cargo.toml`:

```toml
reqwest = { version = "0.12", features = ["json", "stream", "multipart"] }
```

- [ ] **Step 2: Write failing pure helper tests**

Create `src-tauri/src/remote_transcription.rs` with tests first:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoint_joins_base_url_and_translation_flag() {
        assert_eq!(
            transcription_endpoint("http://server:8000/", false).unwrap(),
            "http://server:8000/v1/audio/transcriptions"
        );
        assert_eq!(
            transcription_endpoint("http://server:8000", true).unwrap(),
            "http://server:8000/v1/audio/translations"
        );
    }

    #[test]
    fn language_maps_handy_chinese_variants_to_whisper_code() {
        assert_eq!(remote_language("auto"), None);
        assert_eq!(remote_language("zh-Hans"), Some("zh".to_string()));
        assert_eq!(remote_language("zh-Hant"), Some("zh".to_string()));
        assert_eq!(remote_language("en"), Some("en".to_string()));
    }

    #[test]
    fn parses_json_and_plain_text_responses() {
        assert_eq!(
            parse_transcription_text(r#"{"text":"hello"}"#).unwrap(),
            "hello"
        );
        assert_eq!(parse_transcription_text("hello").unwrap(), "hello");
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
cd src-tauri && cargo test remote_transcription
```

Expected: FAIL because the module and helpers are incomplete.

- [ ] **Step 4: Implement the client helpers**

Implement:

```rust
pub fn transcription_endpoint(base_url: &str, translate_to_english: bool) -> Result<String, String>;
pub fn remote_language(selected_language: &str) -> Option<String>;
pub fn parse_transcription_text(body: &str) -> Result<String, String>;
```

Validation:

- Empty `base_url` returns `Remote transcription base URL is not configured`.
- Empty model returns `Remote transcription model is not configured`.
- Invalid URL returns a clear error.

- [ ] **Step 5: Implement HTTP operations**

Add:

```rust
pub async fn transcribe_remote(samples: Vec<f32>, settings: &AppSettings) -> Result<String, String>;
pub async fn fetch_remote_models(base_url: String, api_key: String) -> Result<Vec<String>, String>;
pub async fn test_remote_connection(base_url: String, model: Option<String>, api_key: String) -> Result<(), String>;
```

Request behavior:

- Timeout: 180 seconds.
- Endpoint: `transcription_endpoint(base_url, settings.translate_to_english)`.
- Multipart fields:
  - `file`: WAV bytes named `recording.wav`.
  - `model`: `settings.remote_transcription_model`.
  - `response_format`: `json`.
  - `language`: only when `remote_language` returns `Some`.
- Auth:
  - Empty API key: no `Authorization`.
  - Non-empty API key: `Authorization: Bearer <key>`.
- Do not send `vad_filter` in v1.

Connection test behavior:

- `POST {base_url}/v1/audio/transcriptions` with a short WAV test file must return success.
- Empty JSON `text` is acceptable for this explicit connection test.

- [ ] **Step 6: Register module**

Add to `src-tauri/src/lib.rs`:

```rust
mod remote_transcription;
```

- [ ] **Step 7: Run tests**

Run:

```bash
cd src-tauri && cargo test remote_transcription
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/remote_transcription.rs src-tauri/src/lib.rs
git commit -m "feat: add remote transcription client"
```

## Chunk 4: Transcription Manager Wiring

### Task 4: Route transcription through local or remote provider

**Files:**

- Modify: `src-tauri/src/managers/transcription.rs`
- Modify: `src-tauri/src/actions.rs`
- Modify: `src-tauri/src/commands/history.rs`
- Modify: `src-tauri/src/commands/models.rs`
- Modify: `src-tauri/src/commands/transcription.rs`

- [ ] **Step 1: Write failing manager tests for provider helpers**

Add testable helpers to `src-tauri/src/managers/transcription.rs` before implementation:

```rust
#[cfg(test)]
mod provider_tests {
    use super::*;
    use crate::settings::TranscriptionProvider;

    #[test]
    fn local_provider_requires_model_preload() {
        assert!(should_preload_local_model(TranscriptionProvider::Local));
        assert!(!should_preload_local_model(TranscriptionProvider::Remote));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd src-tauri && cargo test managers::transcription::provider_tests::local_provider_requires_model_preload
```

Expected: FAIL because `should_preload_local_model` does not exist.

- [ ] **Step 3: Split local transcription from provider routing**

Refactor:

```rust
pub async fn transcribe(&self, audio: Vec<f32>) -> Result<String> {
    let settings = get_settings(&self.app_handle);
    match settings.transcription_provider {
        TranscriptionProvider::Local => {
            let this = self.clone();
            tauri::async_runtime::spawn_blocking(move || this.transcribe_local(audio))
                .await
                .map_err(|e| anyhow::anyhow!("Transcription task panicked: {}", e))?
        }
        TranscriptionProvider::Remote => {
            crate::remote_transcription::transcribe_remote(audio, &settings)
                .await
                .map_err(|e| anyhow::anyhow!(e))
        }
    }
}
```

Move the existing body of `pub fn transcribe(&self, audio: Vec<f32>) -> Result<String>` into:

```rust
fn transcribe_local(&self, audio: Vec<f32>) -> Result<String>
```

Keep local filtering behavior unchanged. For remote results, apply existing filler-word filtering but do not call `apply_custom_words`, because remote results should stay untouched by local custom word correction.

- [ ] **Step 4: Skip local preload in remote mode**

Change `TranscribeAction::start` in `src-tauri/src/actions.rs`:

```rust
let settings = get_settings(app);
if should_preload_local_model(settings.transcription_provider) {
    tm.initiate_model_load();
}
```

Change `retry_history_entry_transcription` in `src-tauri/src/commands/history.rs` the same way.

- [ ] **Step 5: Await manager calls**

In `src-tauri/src/actions.rs`, replace:

```rust
let transcription_result = tm.transcribe(samples);
```

with:

```rust
let transcription_result = tm.transcribe(samples).await;
```

In `src-tauri/src/commands/history.rs`, remove the outer `spawn_blocking` and call:

```rust
let transcription = transcription_manager.transcribe(samples).await?;
```

The local provider still uses `spawn_blocking` internally.

- [ ] **Step 6: Make status commands remote-aware**

When `transcription_provider == Remote`:

- `get_transcription_model_status` should not report local model missing as an error state.
- `is_model_loading` should return `false`.
- Tray/model UI should be able to show remote mode without requiring local `is_model_loaded()`.

- [ ] **Step 7: Run focused checks**

Run:

```bash
cd src-tauri && cargo test managers::transcription::provider_tests
cd src-tauri && cargo check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/managers/transcription.rs src-tauri/src/actions.rs src-tauri/src/commands/history.rs src-tauri/src/commands/models.rs src-tauri/src/commands/transcription.rs
git commit -m "feat: route transcription by provider"
```

## Chunk 5: Commands and Bindings

### Task 5: Add remote transcription commands

**Files:**

- Modify: `src-tauri/src/shortcut/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Regenerate: `src/bindings.ts`

- [ ] **Step 1: Write failing command-adjacent tests**

Add pure validation tests in `src-tauri/src/remote_transcription.rs` if not already covered:

```rust
#[test]
fn validates_required_remote_config() {
    assert!(validate_remote_config("", "model").is_err());
    assert!(validate_remote_config("http://server:8000", "").is_err());
    assert!(validate_remote_config("http://server:8000", "model").is_ok());
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd src-tauri && cargo test remote_transcription::tests::validates_required_remote_config
```

Expected: FAIL until `validate_remote_config` exists.

- [ ] **Step 3: Add commands in `shortcut/mod.rs`**

Add commands:

```rust
pub fn change_transcription_provider_setting(app: AppHandle, provider: String) -> Result<(), String>;
pub fn change_remote_transcription_base_url_setting(app: AppHandle, base_url: String) -> Result<(), String>;
pub fn change_remote_transcription_model_setting(app: AppHandle, model: String) -> Result<(), String>;
pub fn change_remote_transcription_api_key_setting(app: AppHandle, api_key: String) -> Result<(), String>;
pub async fn fetch_remote_transcription_models(app: AppHandle) -> Result<Vec<String>, String>;
pub async fn test_remote_transcription_connection(app: AppHandle) -> Result<(), String>;
```

Validation:

- `provider` accepts only `local` or `remote`.
- Base URL is trimmed; changing it clears cached frontend model options.
- API key is stored in `SecretString`.
- Fetch/test uses current settings.

- [ ] **Step 4: Register commands in `lib.rs`**

Add the commands to `collect_commands!`.

- [ ] **Step 5: Regenerate bindings**

Run:

```bash
bun run tauri dev
```

Stop once `src/bindings.ts` has been regenerated and the app reaches dev mode. If running the full dev app is undesirable, use the repo's existing specta export path during `cargo check` if available.

- [ ] **Step 6: Run checks**

Run:

```bash
cd src-tauri && cargo check
bun run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/shortcut/mod.rs src-tauri/src/lib.rs src/bindings.ts
git commit -m "feat: expose remote transcription settings"
```

## Chunk 6: Frontend Settings UI

### Task 6: Add remote provider settings UI

**Files:**

- Modify: `src/stores/settingsStore.ts`
- Modify: `src/hooks/useSettings.ts`
- Create: `src/components/settings/models/RemoteTranscriptionSettings.tsx`
- Modify: `src/components/settings/models/ModelsSettings.tsx`
- Modify: `src/components/model-selector/ModelSelector.tsx`
- Modify: `src/i18n/locales/en/translation.json`

- [ ] **Step 1: Add i18n keys first**

Add English keys under `settings.models`:

```json
{
  "transcriptionProvider": {
    "title": "Transcription Provider",
    "description": "Choose where speech-to-text runs.",
    "local": "Local Model",
    "remote": "Remote Server"
  },
  "remote": {
    "baseUrl": {
      "title": "Base URL",
      "description": "Server root for an OpenAI-compatible speech-to-text endpoint. A trailing /v1 is accepted.",
      "placeholder": "http://192.168.1.100:8000"
    },
    "model": {
      "title": "Model",
      "description": "Model sent to the transcription endpoint. Refresh models uses GET /v1/models when available.",
      "placeholder": "whisper-1",
      "refreshModels": "Refresh models"
    },
    "apiKey": {
      "title": "API Key",
      "description": "Optional bearer token for protected servers.",
      "placeholder": "Optional"
    },
    "testConnection": "Test transcription",
    "connectionOk": "Remote transcription endpoint is reachable.",
    "connectionFailed": "Remote transcription endpoint test failed."
  }
}
```

- [ ] **Step 2: Run i18n/lint check to verify missing usage fails later if keys are wrong**

Run:

```bash
bun run check:translations
```

Expected: PASS or actionable missing-locale output. If the script requires all locales to contain keys, add placeholder English values to every locale file in the same shape.

- [ ] **Step 3: Add store actions**

In `src/stores/settingsStore.ts`:

- Add setting updaters for:
  - `transcription_provider`
  - `remote_transcription_base_url`
  - `remote_transcription_model`
  - `remote_transcription_api_key`
- Add state:
  - `remoteTranscriptionModelOptions: string[]`
- Add actions:
  - `fetchRemoteTranscriptionModels`
  - `testRemoteTranscriptionConnection`

- [ ] **Step 4: Expose hook helpers**

In `src/hooks/useSettings.ts`, expose:

```ts
remoteTranscriptionModelOptions: string[];
fetchRemoteTranscriptionModels: () => Promise<string[]>;
testRemoteTranscriptionConnection: () => Promise<void>;
```

- [ ] **Step 5: Create `RemoteTranscriptionSettings.tsx`**

Use existing UI primitives:

- `SettingContainer`
- `Input`
- `Button`
- `Dropdown` or existing model select component style

Behavior:

- Base URL input updates `remote_transcription_base_url`.
- Model input/dropdown updates `remote_transcription_model`.
- API Key input updates `remote_transcription_api_key`.
- Refresh button calls `fetchRemoteTranscriptionModels`.
- Test button calls `testRemoteTranscriptionConnection`.
- Disable test when base URL or model is empty.
- Do not put visible explanatory tutorial text beyond labels/descriptions already provided by settings containers.

- [ ] **Step 6: Wire provider selector into `ModelsSettings.tsx`**

At top of Models settings:

- Add provider selector.
- If `local`, render existing downloaded/available model sections unchanged.
- If `remote`, render `RemoteTranscriptionSettings` and hide local model download list.

- [ ] **Step 7: Update `ModelSelector.tsx` display**

When `settings.transcription_provider === "remote"`:

- Display remote model name when set.
- Display remote server mode when model is empty.
- Do not show local model loading/error state.

- [ ] **Step 8: Run frontend checks**

Run:

```bash
bun run lint
bun run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/stores/settingsStore.ts src/hooks/useSettings.ts src/components/settings/models/RemoteTranscriptionSettings.tsx src/components/settings/models/ModelsSettings.tsx src/components/model-selector/ModelSelector.tsx src/i18n/locales
git commit -m "feat: add remote transcription settings UI"
```

## Chunk 7: End-to-End Verification

### Task 7: Verify against the home server

**Files:**

- No production file changes expected unless verification finds bugs.

- [ ] **Step 1: Confirm server is reachable**

Run:

```bash
curl -sS http://192.168.4.200:8000/api/ps
```

Expected:

```text
{"models":["whisper-1"]}
```

- [ ] **Step 2: Run app**

Run:

```bash
bun run tauri dev
```

- [ ] **Step 3: Configure remote transcription manually**

Use:

```text
Transcription Provider: Remote Server
Base URL: http://192.168.4.200:8000
Model: whisper-1
API Key: empty
```

- [ ] **Step 4: Test transcription**

Click `Test transcription`.

Expected: success toast.

- [ ] **Step 5: Record a short phrase**

Use the normal transcription shortcut.

Expected:

- Handy records locally.
- Handy uploads WAV bytes to the remote server.
- The remote server returns text.
- Handy applies existing post-processing only if requested.
- Handy pastes text into the active app.
- History stores the local WAV and transcript.

- [ ] **Step 6: Verify no fallback**

Change Base URL to an unused port:

```text
http://192.168.4.200:65535
```

Record again.

Expected:

- Transcription fails with a remote connection error.
- Handy does not load or use a local model.

- [ ] **Step 7: Run final checks**

Run:

```bash
bun run lint
bun run build
cd src-tauri && cargo test
cd src-tauri && cargo check
```

Expected: PASS.

- [ ] **Step 8: Commit verification fixes if needed**

Only commit if verification required code changes:

```bash
git add <changed-files>
git commit -m "fix: harden remote transcription flow"
```

## Rollout Notes

- Do not commit private defaults such as `192.168.4.200`.
- Do not log the remote API key.
- Do not rename or reuse `PostProcessProvider`; it is a separate concept.
- Do not add multiple remote server profiles in v1.
- Do not add arbitrary HTTP templates in v1.
- Keep local model download and remote server setup visually separate.
