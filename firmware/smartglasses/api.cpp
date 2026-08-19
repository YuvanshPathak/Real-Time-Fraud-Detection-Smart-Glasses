/**
 * @file api.cpp
 * @brief HTTP client for the Fraud Detection Cloud Backend.
 *
 * Sends multipart/form-data POST requests to /face-check and /voice-check,
 * and a JSON POST to /risk-score.  Parses the JSON responses with a simple
 * key-value string search (no external JSON library required).
 */

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFiClient.h>

#include "config.h"
#include "api.h"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract a float value from a JSON string by looking for "key": <value>.
 * Returns defaultVal if the key is not found.
 */
static float extractFloat(const String &json, const char *key, float defaultVal = 1.0f) {
    String searchKey = String("\"") + key + "\":";
    int idx = json.indexOf(searchKey);
    if (idx < 0) return defaultVal;
    idx += searchKey.length();
    // Skip optional space
    while (idx < (int)json.length() && json[idx] == ' ') idx++;
    return json.substring(idx).toFloat();
}

/**
 * Extract a quoted string value for "key": "value".
 * Fills outBuf (max outLen chars including null terminator).
 * Returns true on success.
 */
static bool extractString(const String &json, const char *key,
                           char *outBuf, size_t outLen) {
    String searchKey = String("\"") + key + "\": \"";
    int idx = json.indexOf(searchKey);
    if (idx < 0) {
        // Try without space after colon
        searchKey = String("\"") + key + "\":\"";
        idx = json.indexOf(searchKey);
        if (idx < 0) return false;
    }
    idx += searchKey.length();
    int end = json.indexOf('"', idx);
    if (end < 0) return false;
    size_t len = (size_t)(end - idx);
    if (len >= outLen) len = outLen - 1;
    json.substring(idx, idx + (int)len).toCharArray(outBuf, outLen);
    return true;
}

// ─── WAV Header Builder ───────────────────────────────────────────────────────

/**
 * Write a standard 44-byte PCM WAV header into buf.
 * buf must be at least 44 bytes.
 */
static void buildWavHeader(uint8_t *buf, uint32_t pcm_bytes,
                            uint32_t sample_rate, uint16_t channels = 1,
                            uint16_t bits_per_sample = 16) {
    uint32_t byte_rate   = sample_rate * channels * bits_per_sample / 8;
    uint16_t block_align = channels * bits_per_sample / 8;
    uint32_t data_chunk  = pcm_bytes;
    uint32_t riff_chunk  = 36 + pcm_bytes;

    auto w2 = [&](int offset, uint16_t v) {
        buf[offset]     = v & 0xFF;
        buf[offset + 1] = (v >> 8) & 0xFF;
    };
    auto w4 = [&](int offset, uint32_t v) {
        buf[offset]     =  v        & 0xFF;
        buf[offset + 1] = (v >> 8)  & 0xFF;
        buf[offset + 2] = (v >> 16) & 0xFF;
        buf[offset + 3] = (v >> 24) & 0xFF;
    };

    memcpy(buf,      "RIFF", 4); w4(4,  riff_chunk);
    memcpy(buf + 8,  "WAVE", 4);
    memcpy(buf + 12, "fmt ", 4); w4(16, 16);         // subchunk1 size
    w2(20, 1);                                        // PCM format
    w2(22, channels);
    w4(24, sample_rate);
    w4(28, byte_rate);
    w2(32, block_align);
    w2(34, bits_per_sample);
    memcpy(buf + 36, "data", 4); w4(40, data_chunk);
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * @brief POST a JPEG image to /face-check.
 */
ApiResult postFaceCheck(const uint8_t *jpeg_buf, size_t jpeg_len) {
    ApiResult result = {false, 1.0f};
    if (!jpeg_buf || jpeg_len == 0) return result;

    HTTPClient http;
    String url = String(BACKEND_URL) + "/face-check";
    http.begin(url);
    http.setTimeout(15000);

    // Build multipart/form-data body manually
    String boundary = "----ESP32Boundary7a3f";
    String header = "--" + boundary + "\r\n"
                    "Content-Disposition: form-data; name=\"image\"; filename=\"frame.jpg\"\r\n"
                    "Content-Type: image/jpeg\r\n\r\n";
    String footer = "\r\n--" + boundary + "--\r\n";

    size_t body_len = header.length() + jpeg_len + footer.length();
    uint8_t *body = (uint8_t *)malloc(body_len);
    if (!body) {
        Serial.println("[API] postFaceCheck: malloc failed.");
        http.end();
        return result;
    }
    memcpy(body,                           header.c_str(), header.length());
    memcpy(body + header.length(),         jpeg_buf,       jpeg_len);
    memcpy(body + header.length() + jpeg_len, footer.c_str(), footer.length());

    http.addHeader("Content-Type",
                   "multipart/form-data; boundary=" + boundary);

    int code = http.POST(body, body_len);
    free(body);

    if (code != 200) {
        Serial.printf("[API] /face-check HTTP %d\n", code);
        http.end();
        return result;
    }

    String response = http.getString();
    http.end();
    Serial.println("[API] /face-check -> " + response);

    result.score = extractFloat(response, "face_liveness_score", 1.0f);
    result.ok    = true;
    return result;
}

/**
 * @brief POST PCM audio to /voice-check as a WAV file.
 */
ApiResult postVoiceCheck(const int16_t *pcm_buf, size_t pcm_samples,
                          uint32_t sample_rate) {
    ApiResult result = {false, 1.0f};
    if (!pcm_buf || pcm_samples == 0) return result;

    uint32_t pcm_bytes = pcm_samples * sizeof(int16_t);
    size_t   wav_len   = 44 + pcm_bytes;
    uint8_t *wav_buf   = (uint8_t *)malloc(wav_len);
    if (!wav_buf) {
        Serial.println("[API] postVoiceCheck: malloc failed.");
        return result;
    }

    buildWavHeader(wav_buf, pcm_bytes, sample_rate);
    memcpy(wav_buf + 44, pcm_buf, pcm_bytes);

    HTTPClient http;
    String url = String(BACKEND_URL) + "/voice-check";
    http.begin(url);
    http.setTimeout(20000);

    String boundary = "----ESP32Boundary9c1e";
    String header = "--" + boundary + "\r\n"
                    "Content-Disposition: form-data; name=\"audio\"; filename=\"audio.wav\"\r\n"
                    "Content-Type: audio/wav\r\n\r\n";
    String footer = "\r\n--" + boundary + "--\r\n";

    size_t body_len = header.length() + wav_len + footer.length();
    uint8_t *body   = (uint8_t *)malloc(body_len);
    if (!body) {
        Serial.println("[API] postVoiceCheck: body malloc failed.");
        free(wav_buf);
        http.end();
        return result;
    }
    memcpy(body,                          header.c_str(), header.length());
    memcpy(body + header.length(),        wav_buf,        wav_len);
    memcpy(body + header.length() + wav_len, footer.c_str(), footer.length());
    free(wav_buf);

    http.addHeader("Content-Type",
                   "multipart/form-data; boundary=" + boundary);

    int code = http.POST(body, body_len);
    free(body);

    if (code != 200) {
        Serial.printf("[API] /voice-check HTTP %d\n", code);
        http.end();
        return result;
    }

    String response = http.getString();
    http.end();
    Serial.println("[API] /voice-check -> " + response);

    result.score = extractFloat(response, "voice_liveness_score", 1.0f);
    result.ok    = true;
    return result;
}

/**
 * @brief POST all four modality scores to /risk-score and extract the verdict.
 */
bool postRiskScore(float face_score, float voice_score,
                   float id_score,   float doc_score,
                   char *out_level,  size_t out_level_len) {
    HTTPClient http;
    String url = String(BACKEND_URL) + "/risk-score";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(10000);

    // Build JSON body
    char body[256];
    snprintf(body, sizeof(body),
             "{\"face_liveness_score\":%.4f,"
             "\"voice_liveness_score\":%.4f,"
             "\"face_id_match_score\":%.4f,"
             "\"doc_authenticity_score\":%.4f}",
             face_score, voice_score, id_score, doc_score);

    int code = http.POST(body);
    if (code != 200) {
        Serial.printf("[API] /risk-score HTTP %d\n", code);
        http.end();
        return false;
    }

    String response = http.getString();
    http.end();
    Serial.println("[API] /risk-score -> " + response);

    return extractString(response, "risk_level", out_level, out_level_len);
}
