import assert from "node:assert/strict";
import { hasTranscriptionBackendConfigured } from "./onboarding";

assert.equal(hasTranscriptionBackendConfigured(false, "local"), false);
assert.equal(hasTranscriptionBackendConfigured(true, "local"), true);
assert.equal(hasTranscriptionBackendConfigured(false, "remote"), true);
