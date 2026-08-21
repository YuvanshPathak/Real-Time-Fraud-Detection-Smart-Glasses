#ifndef API_H
#define API_H

#include <cstddef>
#include <cstdint>

struct VoiceCheckResult {
  bool ok = false;              // true only if the backend returned a usable score
  float voiceLivenessScore = 0.0f;
  bool spoofDetected = false;
};

struct RiskScoreResult {
  bool ok = false;
  float fraudRiskScore = 0.0f;
  const char *riskLevel = "";   // points into a static buffer, valid until next call
};

// POSTs a WAV-encoded PCM buffer to /voice-check as multipart/form-data.
// samples/sampleCount describe raw 16-bit mono PCM; this function builds the
// WAV header itself.
VoiceCheckResult postVoiceCheck(const int16_t *samples, size_t sampleCount, int sampleRate);

// POSTs to /risk-score. voiceLivenessScore is the only modality this firmware
// evaluates this phase — face/doc/face-id are omitted from the JSON body
// entirely (not sent as 0 or 1.0), matching the backend's fusion contract:
// an omitted modality is excluded from the weighted average, not assumed
// genuine or fraudulent.
RiskScoreResult postRiskScore(float voiceLivenessScore);

#endif
