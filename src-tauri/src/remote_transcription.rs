use crate::audio_toolkit::encode_wav_bytes;
use crate::settings::AppSettings;
use reqwest::multipart::{Form, Part};
use reqwest::Url;
use serde_json::Value;
use std::time::Duration;

const REMOTE_TRANSCRIPTION_TIMEOUT: Duration = Duration::from_secs(180);

pub fn transcription_endpoint(
    base_url: &str,
    translate_to_english: bool,
) -> Result<String, String> {
    let base_url = normalized_base_url(base_url)?;
    let path = if translate_to_english {
        "v1/audio/translations"
    } else {
        "v1/audio/transcriptions"
    };
    Ok(format!("{}/{}", base_url, path))
}

pub fn remote_language(selected_language: &str) -> Option<String> {
    let selected_language = selected_language.trim();
    match selected_language {
        "" | "auto" => None,
        "zh-Hans" | "zh-Hant" => Some("zh".to_string()),
        language => Some(language.to_string()),
    }
}

pub fn remote_hotwords(custom_words: &[String]) -> Option<String> {
    let hotwords = custom_words
        .iter()
        .map(|word| word.trim())
        .filter(|word| !word.is_empty())
        .collect::<Vec<_>>();

    if hotwords.is_empty() {
        None
    } else {
        Some(hotwords.join(", "))
    }
}

pub fn parse_transcription_text(body: &str) -> Result<String, String> {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return Err("Remote transcription response is empty".to_string());
    }

    match serde_json::from_str::<Value>(trimmed) {
        Ok(value) => match value {
            Value::Object(map) => map
                .get("text")
                .and_then(Value::as_str)
                .map(ToString::to_string)
                .ok_or_else(|| "Remote transcription response did not include text".to_string()),
            Value::String(text) => Ok(text),
            _ => Err("Remote transcription response did not include text".to_string()),
        },
        Err(_) => Ok(trimmed.to_string()),
    }
}

pub async fn transcribe_remote(
    samples: Vec<f32>,
    settings: &AppSettings,
) -> Result<String, String> {
    let model = settings.remote_transcription_model.trim();
    validate_remote_config(&settings.remote_transcription_base_url, model)?;

    let url = transcription_endpoint(
        &settings.remote_transcription_base_url,
        settings.translate_to_english,
    )?;
    let wav_bytes =
        encode_wav_bytes(&samples).map_err(|e| format!("Failed to encode WAV upload: {}", e))?;
    let file = Part::bytes(wav_bytes)
        .file_name("recording.wav")
        .mime_str("audio/wav")
        .map_err(|e| format!("Failed to prepare WAV upload: {}", e))?;

    let mut form = Form::new()
        .part("file", file)
        .text("model", model.to_string())
        .text("response_format", "json".to_string());

    if let Some(language) = remote_language(&settings.selected_language) {
        form = form.text("language", language);
    }

    if !settings.translate_to_english {
        if let Some(hotwords) = remote_hotwords(&settings.custom_words) {
            form = form.text("hotwords", hotwords);
        }
    }

    let client = create_client()?;
    let request = authorize(
        client.post(url).multipart(form),
        settings.remote_transcription_api_key.expose(),
    );

    let response = request
        .send()
        .await
        .map_err(|e| format!("Remote transcription request failed: {}", e))?;
    let body = successful_body(response, "Remote transcription request").await?;

    parse_transcription_text(&body)
}

pub async fn fetch_remote_models(base_url: String, api_key: String) -> Result<Vec<String>, String> {
    let base_url = normalized_base_url(&base_url)?;
    let client = create_client()?;
    let response = authorize(client.get(format!("{}/v1/models", base_url)), &api_key)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch remote transcription models: {}", e))?;
    let body = successful_body(response, "Remote transcription model list request").await?;
    parse_model_ids(&body)
}

pub async fn test_remote_connection(
    base_url: String,
    model: Option<String>,
    api_key: String,
) -> Result<(), String> {
    let base_url = normalized_base_url(&base_url)?;
    let client = create_client()?;

    let health_response = authorize(client.get(format!("{}/health", base_url)), &api_key)
        .send()
        .await
        .map_err(|e| format!("Remote transcription health check failed: {}", e))?;
    successful_body(health_response, "Remote transcription health check").await?;

    if let Some(model) = model.map(|value| value.trim().to_string()) {
        if !model.is_empty() {
            let model_response = authorize(
                client.get(format!(
                    "{}/v1/models/{}",
                    base_url,
                    percent_encode_path_segment(&model)
                )),
                &api_key,
            )
            .send()
            .await
            .map_err(|e| format!("Remote transcription model check failed: {}", e))?;
            successful_body(model_response, "Remote transcription model check").await?;
        }
    }

    Ok(())
}

pub fn validate_remote_config(base_url: &str, model: &str) -> Result<(), String> {
    if base_url.trim().is_empty() {
        return Err("Remote transcription base URL is not configured".to_string());
    }
    if model.trim().is_empty() {
        return Err("Remote transcription model is not configured".to_string());
    }
    normalized_base_url(base_url).map(|_| ())
}

fn normalized_base_url(base_url: &str) -> Result<String, String> {
    let base_url = base_url.trim();
    if base_url.is_empty() {
        return Err("Remote transcription base URL is not configured".to_string());
    }

    let parsed = Url::parse(base_url)
        .map_err(|e| format!("Invalid remote transcription base URL: {}", e))?;
    if parsed.cannot_be_a_base() {
        return Err("Invalid remote transcription base URL".to_string());
    }

    Ok(base_url.trim_end_matches('/').to_string())
}

fn create_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(REMOTE_TRANSCRIPTION_TIMEOUT)
        .build()
        .map_err(|e| format!("Failed to build remote transcription client: {}", e))
}

fn authorize(builder: reqwest::RequestBuilder, api_key: &str) -> reqwest::RequestBuilder {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        builder
    } else {
        builder.bearer_auth(api_key)
    }
}

async fn successful_body(response: reqwest::Response, operation: &str) -> Result<String, String> {
    let status = response.status();
    let body = response
        .text()
        .await
        .unwrap_or_else(|_| "Failed to read response body".to_string());

    if status.is_success() {
        Ok(body)
    } else {
        Err(format!(
            "{} failed with status {}: {}",
            operation, status, body
        ))
    }
}

fn parse_model_ids(body: &str) -> Result<Vec<String>, String> {
    let parsed: Value =
        serde_json::from_str(body).map_err(|e| format!("Failed to parse model list: {}", e))?;
    let mut models = Vec::new();

    if let Some(data) = parsed.get("data").and_then(Value::as_array) {
        for entry in data {
            if let Some(id) = entry.get("id").and_then(Value::as_str) {
                models.push(id.to_string());
            } else if let Some(name) = entry.get("name").and_then(Value::as_str) {
                models.push(name.to_string());
            }
        }
    } else if let Some(array) = parsed.as_array() {
        for entry in array {
            if let Some(model) = entry.as_str() {
                models.push(model.to_string());
            }
        }
    } else if let Some(array) = parsed.get("models").and_then(Value::as_array) {
        for entry in array {
            if let Some(model) = entry.as_str() {
                models.push(model.to_string());
            }
        }
    }

    Ok(models)
}

fn percent_encode_path_segment(segment: &str) -> String {
    let mut encoded = String::new();
    for byte in segment.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                encoded.push(byte as char);
            }
            _ => encoded.push_str(&format!("%{:02X}", byte)),
        }
    }
    encoded
}

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
    fn hotwords_are_omitted_when_empty() {
        assert_eq!(remote_hotwords(&[]), None);
        assert_eq!(
            remote_hotwords(&["Handy".to_string(), "ChargeBee".to_string()]),
            Some("Handy, ChargeBee".to_string())
        );
    }

    #[test]
    fn parses_json_and_plain_text_responses() {
        assert_eq!(
            parse_transcription_text(r#"{"text":"hello"}"#).unwrap(),
            "hello"
        );
        assert_eq!(parse_transcription_text("hello").unwrap(), "hello");
    }

    #[test]
    fn validates_required_remote_config() {
        assert!(validate_remote_config("", "model").is_err());
        assert!(validate_remote_config("http://server:8000", "").is_err());
        assert!(validate_remote_config("http://server:8000", "model").is_ok());
    }
}
