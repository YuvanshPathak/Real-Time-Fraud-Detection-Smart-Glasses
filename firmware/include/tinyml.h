#ifndef TINYML_H
#define TINYML_H

#include <cstddef>
#include <cstdint>

// Synthetic-proof-of-concept model — see ml/README.md. Proves the on-device
// feature-extraction + TFLite Micro inference pipeline works end to end; does
// NOT detect real voice spoofing yet (trained on fabricated signals, not real
// genuine/spoof audio). Retrain on real hardware-captured audio before
// trusting this for anything beyond pipeline validation — see ml/README.md
// "Retraining on real data."
struct TinyMLResult {
  bool ok = false;             // true only if inference actually ran
  float livenessScore = 0.0f;  // 0..1, higher = more genuine (same convention as voice_liveness_score)
};

// Allocates the TFLite Micro interpreter/tensor arena and loads the embedded
// model (voice_tinyml_model.h). Call once during setup(). Returns false on
// any failure (arena too small, unsupported op, bad model) — callers should
// treat that as "TinyML unavailable this boot" and continue without it,
// exactly like microphone.cpp's initMicrophone() failure handling.
bool initTinyML();

// Extracts log-mel features from a raw PCM buffer and runs on-device
// inference. samples/sampleCount must be the same 5s/16kHz buffer
// recordToBuffer() already produces (TINYML_N_SAMPLES samples at
// TINYML_SAMPLE_RATE, see tinyml_feature_config.h) — no separate capture
// needed. Safe to call even if initTinyML() failed or was never called
// (returns {ok=false}).
TinyMLResult runTinyMLInference(const int16_t *samples, size_t sampleCount, int sampleRate);

#endif
