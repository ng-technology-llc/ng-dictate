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

fn model_list_endpoint(base_url: &str) -> Result<String, String> {
    let base_url = normalized_base_url(base_url)?;
    Ok(format!("{}/v1/models", base_url))
}

pub fn remote_language(selected_language: &str) -> Option<String> {
    let selected_language = selected_language.trim();
    match selected_language {
        "" | "auto" => None,
        "zh-Hans" | "zh-Hant" => Some("zh".to_string()),
        language => Some(language.to_string()),
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
    let mut form = transcription_form(wav_bytes, model)?;

    if let Some(language) = remote_language(&settings.selected_language) {
        form = form.text("language", language);
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
    let url = model_list_endpoint(&base_url)?;
    let client = create_client()?;
    let response = authorize(client.get(url), &api_key)
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
    let model = model.unwrap_or_default();
    validate_remote_config(&base_url, &model)?;
    let url = transcription_endpoint(&base_url, false)?;
    let silence = vec![0.0_f32; 4000];
    let wav_bytes = encode_wav_bytes(&silence)
        .map_err(|e| format!("Failed to encode remote transcription test WAV: {}", e))?;
    let form = transcription_form(wav_bytes, model.trim())?;
    let client = create_client()?;

    let response = authorize(client.post(url).multipart(form), &api_key)
        .send()
        .await
        .map_err(|e| format!("Remote transcription test request failed: {}", e))?;
    let body = successful_body(response, "Remote transcription test request").await?;
    parse_transcription_text(&body)?;

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

pub fn normalize_remote_base_url(base_url: &str) -> Result<String, String> {
    normalized_base_url(base_url)
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

    let mut parsed = parsed;
    parsed.set_query(None);
    parsed.set_fragment(None);

    let mut path = parsed.path().trim_end_matches('/').to_string();
    for suffix in ["/v1/audio/transcriptions", "/v1/audio/translations"] {
        if path == suffix || path.ends_with(suffix) {
            path = path[..path.len() - suffix.len()].to_string();
            break;
        }
    }

    if path == "/v1" || path.ends_with("/v1") {
        let stripped = &path[..path.len() - "/v1".len()];
        parsed.set_path(stripped);
    } else {
        parsed.set_path(&path);
    }

    Ok(parsed.as_str().trim_end_matches('/').to_string())
}

fn transcription_form(wav_bytes: Vec<u8>, model: &str) -> Result<Form, String> {
    let file = Part::bytes(wav_bytes)
        .file_name("recording.wav")
        .mime_str("audio/wav")
        .map_err(|e| format!("Failed to prepare WAV upload: {}", e))?;

    Ok(Form::new()
        .part("file", file)
        .text("model", model.to_string())
        .text("response_format", "json".to_string()))
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
            } else if let Some(id) = entry.get("id").and_then(Value::as_str) {
                models.push(id.to_string());
            } else if let Some(name) = entry.get("name").and_then(Value::as_str) {
                models.push(name.to_string());
            }
        }
    }

    Ok(models)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::get_default_settings;
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::sync::mpsc;
    use std::thread;

    struct CapturedRequest {
        method: String,
        path: String,
        body: String,
    }

    fn spawn_response_server(
        status: &str,
        response_body: &str,
    ) -> (String, mpsc::Receiver<CapturedRequest>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind test server");
        let addr = listener.local_addr().expect("local addr");
        let status = status.to_string();
        let response_body = response_body.to_string();
        let (tx, rx) = mpsc::channel();

        thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept request");
            let request = read_request(&mut stream);
            tx.send(request).expect("send captured request");

            let response = format!(
                "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                status,
                response_body.len(),
                response_body
            );
            stream
                .write_all(response.as_bytes())
                .expect("write response");
        });

        (format!("http://{}", addr), rx)
    }

    fn read_request(stream: &mut TcpStream) -> CapturedRequest {
        let mut buffer = Vec::new();
        let mut chunk = [0_u8; 4096];
        let header_end = loop {
            let read = stream.read(&mut chunk).expect("read request");
            assert!(read > 0, "connection closed before headers completed");
            buffer.extend_from_slice(&chunk[..read]);

            if let Some(header_end) = find_header_end(&buffer) {
                break header_end;
            }
        };

        let header_text = String::from_utf8_lossy(&buffer[..header_end]);
        let mut lines = header_text.lines();
        let request_line = lines.next().expect("request line");
        let mut request_parts = request_line.split_whitespace();
        let method = request_parts.next().expect("method").to_string();
        let path = request_parts.next().expect("path").to_string();

        let content_length = header_text
            .lines()
            .find_map(|line| {
                let (name, value) = line.split_once(':')?;
                if name.eq_ignore_ascii_case("content-length") {
                    value.trim().parse::<usize>().ok()
                } else {
                    None
                }
            })
            .unwrap_or(0);

        while buffer.len() < header_end + content_length {
            let read = stream.read(&mut chunk).expect("read request body");
            assert!(read > 0, "connection closed before body completed");
            buffer.extend_from_slice(&chunk[..read]);
        }

        CapturedRequest {
            method,
            path,
            body: String::from_utf8_lossy(&buffer[header_end..header_end + content_length])
                .to_string(),
        }
    }

    fn find_header_end(buffer: &[u8]) -> Option<usize> {
        buffer
            .windows(4)
            .position(|window| window == b"\r\n\r\n")
            .map(|index| index + 4)
    }

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
    fn endpoint_accepts_base_url_with_trailing_v1_segment() {
        assert_eq!(
            transcription_endpoint("http://server:8000/v1", false).unwrap(),
            "http://server:8000/v1/audio/transcriptions"
        );
        assert_eq!(
            transcription_endpoint("https://example.test/proxy/v1/", true).unwrap(),
            "https://example.test/proxy/v1/audio/translations"
        );
    }

    #[test]
    fn endpoints_accept_full_transcription_endpoint_inputs() {
        assert_eq!(
            transcription_endpoint("http://server:8000/v1/audio/transcriptions", false).unwrap(),
            "http://server:8000/v1/audio/transcriptions"
        );
        assert_eq!(
            model_list_endpoint("http://server:8000/v1/audio/transcriptions").unwrap(),
            "http://server:8000/v1/models"
        );
        assert_eq!(
            model_list_endpoint("https://example.test/proxy/v1/audio/translations/").unwrap(),
            "https://example.test/proxy/v1/models"
        );
    }

    #[test]
    fn remote_base_url_normalization_is_available_for_settings() {
        assert_eq!(
            normalize_remote_base_url("http://server:8000/v1/").unwrap(),
            "http://server:8000"
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

    #[test]
    fn parses_model_ids_from_models_object_array() {
        assert_eq!(
            parse_model_ids(r#"{"models":[{"id":"whisper-large-v3"},{"name":"sensevoice"}]}"#)
                .unwrap(),
            vec!["whisper-large-v3".to_string(), "sensevoice".to_string()]
        );
    }

    #[test]
    fn validates_required_remote_config() {
        assert!(validate_remote_config("", "model").is_err());
        assert!(validate_remote_config("http://server:8000", "").is_err());
        assert!(validate_remote_config("http://server:8000", "model").is_ok());
    }

    #[tokio::test]
    async fn test_connection_uses_transcription_endpoint_without_health_check() {
        let (base_url, request_rx) = spawn_response_server("200 OK", r#"{"text":""}"#);

        test_remote_connection(base_url, Some("whisper-1".to_string()), String::new())
            .await
            .expect("test connection");

        let request = request_rx.recv().expect("captured request");
        assert_eq!(request.method, "POST");
        assert_eq!(request.path, "/v1/audio/transcriptions");
        assert!(request.body.contains(r#"name="file""#));
        assert!(request.body.contains(r#"name="model""#));
        assert!(request.body.contains("whisper-1"));
        assert!(request.body.contains(r#"name="response_format""#));
        assert!(request.body.contains("json"));
    }

    #[tokio::test]
    async fn fetch_models_uses_models_endpoint_when_configured_with_transcription_endpoint() {
        let (base_url, request_rx) =
            spawn_response_server("200 OK", r#"{"data":[{"id":"whisper-large-v3"}]}"#);
        let endpoint = format!("{}/v1/audio/transcriptions", base_url);

        let models = fetch_remote_models(endpoint, String::new())
            .await
            .expect("fetch models");

        let request = request_rx.recv().expect("captured request");
        assert_eq!(request.method, "GET");
        assert_eq!(request.path, "/v1/models");
        assert_eq!(models, vec!["whisper-large-v3".to_string()]);
    }

    #[tokio::test]
    async fn remote_transcription_posts_standard_fields_without_hotwords() {
        let (base_url, request_rx) = spawn_response_server("200 OK", r#"{"text":"hello"}"#);
        let mut settings = get_default_settings();
        settings.remote_transcription_base_url = base_url;
        settings.remote_transcription_model = "whisper-1".to_string();
        settings.selected_language = "en".to_string();
        settings.custom_words = vec!["Handy".to_string(), "ChargeBee".to_string()];

        transcribe_remote(vec![0.0_f32; 1600], &settings)
            .await
            .expect("remote transcription");

        let request = request_rx.recv().expect("captured request");
        assert_eq!(request.method, "POST");
        assert_eq!(request.path, "/v1/audio/transcriptions");
        assert!(request.body.contains(r#"name="file""#));
        assert!(request.body.contains(r#"name="model""#));
        assert!(request.body.contains("whisper-1"));
        assert!(request.body.contains(r#"name="language""#));
        assert!(request.body.contains("en"));
        assert!(!request.body.contains(r#"name="hotwords""#));
        assert!(!request.body.contains("ChargeBee"));
    }
}
