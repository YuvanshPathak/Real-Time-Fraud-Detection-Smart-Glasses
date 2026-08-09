#ifndef API_H
#define API_H

#include <stdint.h>
#include <stddef.h>

/**
 * @brief Result of a single backend API call.
 *
 * score is the modality liveness score (0.0 = spoofed, 1.0 = genuine).
 * ok    is false if the HTTP request failed entirely (network / server error).
 */
struct ApiResult {
    bool  ok;
    float score;
};

/**
 * @brief POST a JPEG image to /face-check.
 *
 * @param jpeg_buf  Pointer to JPEG byte data.
 * @param jpeg_len  Length of the JPEG data in bytes.
 * @return ApiResult with ok=true and the face_liveness_score on success.
 */
ApiResult postFaceCheck(const uint8_t *jpeg_buf, size_t jpeg_len);

/**
 * @brief POST a WAV audio buffer to /voice-check.
 *
 * Builds an in-memory WAV file (44-byte header + PCM payload) before sending.
 *
 * @param pcm_buf    Pointer to 16-bit PCM samples.
 * @param pcm_samples Number of samples (not bytes).
 * @param sample_rate Sample rate in Hz (e.g. 16000).
 * @return ApiResult with ok=true and the voice_liveness_score on success.
 */
ApiResult postVoiceCheck(const int16_t *pcm_buf, size_t pcm_samples, uint32_t sample_rate);

/**
 * @brief POST four modality scores to /risk-score and retrieve the verdict.
 *
 * @param face_score  Face liveness score (0–1).
 * @param voice_score Voice liveness score (0–1).
 * @param id_score    Face-to-ID match score (0–1). Pass 1.0 if not checked.
 * @param doc_score   Document authenticity score (0–1). Pass 1.0 if not checked.
 * @param out_level   Output buffer (e.g. "SAFE", "SUSPICIOUS", "FRAUD").
 * @param out_level_len Size of out_level buffer.
 * @return true if the request succeeded and out_level was populated.
 */
bool postRiskScore(float face_score, float voice_score,
                   float id_score,   float doc_score,
                   char *out_level,  size_t out_level_len);

#endif
