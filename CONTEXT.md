# Handy

Handy turns recorded speech into text and delivers that text to the user's current workflow. This glossary defines the product language used for speech capture, transcription, and related providers.

## Language

**Remote Transcription Provider**:
A transcription provider that accepts recorded audio from Handy and returns transcript text from a separate service.
_Avoid_: Custom provider, post-processing provider, home server provider

**OpenAI-compatible Audio Transcription API**:
An audio transcription API that follows the OpenAI-style speech-to-text contract for submitting audio and receiving transcript text.
_Avoid_: arbitrary HTTP provider, custom JSON protocol

**Remote Transcription Model**:
The model identifier that Handy asks a Remote Transcription Provider to use for a transcription request.
_Avoid_: local model, downloaded model
