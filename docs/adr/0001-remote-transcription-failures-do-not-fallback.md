# Remote Transcription Failures Do Not Fallback

When the user selects a Remote Transcription Provider, NG Dictate treats that provider as the chosen transcription path. If the remote service is unavailable, rejects the request, or exceeds the 180-second request timeout, NG Dictate reports the transcription failure instead of silently retrying with a local model, because automatic fallback would make latency, model quality, and privacy expectations unpredictable.
