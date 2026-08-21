#include "api.h"
#include "config.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <esp_heap_caps.h>
#include <cstring>

static const char *BOUNDARY = "----ESP32VoiceBoundary7MA4YWxkTrZu0gW";

// Standard 44-byte canonical PCM WAV header.
static void writeWavHeader(uint8_t *header, uint32_t dataSize, uint32_t sampleRate) {
  uint32_t chunkSize = 36 + dataSize;
  uint32_t byteRate = sampleRate * 2; // 16-bit mono
  uint32_t subchunk1Size = 16;
  uint16_t audioFormat = 1;
  uint16_t numChannels = 1;
  uint16_t blockAlign = 2;
  uint16_t bitsPerSample = 16;

  memcpy(header, "RIFF", 4);
  memcpy(header + 4, &chunkSize, 4);
  memcpy(header + 8, "WAVE", 4);
  memcpy(header + 12, "fmt ", 4);
  memcpy(header + 16, &subchunk1Size, 4);
  memcpy(header + 20, &audioFormat, 2);
  memcpy(header + 22, &numChannels, 2);
  memcpy(header + 24, &sampleRate, 4);
  memcpy(header + 28, &byteRate, 4);
  memcpy(header + 32, &blockAlign, 2);
  memcpy(header + 34, &bitsPerSample, 2);
  memcpy(header + 36, "data", 4);
  memcpy(header + 40, &dataSize, 4);
}

// Prefers PSRAM, falls back to internal SRAM. Mirrors microphone.cpp's
// allocator pattern — confirmed necessary last phase, plain malloc()
// deterministically failed for buffers this size (WAV + multipart overhead).
static uint8_t *allocBuffer(size_t size) {
  uint8_t *buf = (uint8_t *)heap_caps_malloc(size, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (buf) return buf;
  Serial.println("[api] PSRAM allocation failed, falling back to SRAM");
  return (uint8_t *)malloc(size);
}

VoiceCheckResult postVoiceCheck(const int16_t *samples, size_t sampleCount, int sampleRate) {
  VoiceCheckResult result;

  if (!WiFi.isConnected()) {
    Serial.println("[api] postVoiceCheck: WiFi not connected");
    return result;
  }

  const uint32_t dataSize = sampleCount * sizeof(int16_t);
  const String partHeader = String("--") + BOUNDARY + "\r\n" +
    "Content-Disposition: form-data; name=\"audio\"; filename=\"voice.wav\"\r\n" +
    "Content-Type: audio/wav\r\n\r\n";
  const String partFooter = String("\r\n--") + BOUNDARY + "--\r\n";

  const size_t totalLen = partHeader.length() + 44 + dataSize + partFooter.length();
  uint8_t *body = allocBuffer(totalLen);
  if (!body) {
    Serial.println("[api] postVoiceCheck: body allocation failed");
    return result;
  }

  size_t offset = 0;
  memcpy(body + offset, partHeader.c_str(), partHeader.length());
  offset += partHeader.length();
  writeWavHeader(body + offset, dataSize, sampleRate);
  offset += 44;
  memcpy(body + offset, samples, dataSize);
  offset += dataSize;
  memcpy(body + offset, partFooter.c_str(), partFooter.length());
  offset += partFooter.length();

  // Longer timeouts + a single retry: a marginal Wi-Fi link fails in
  // different ways depending on exact timing (connect refused, mid-upload
  // write failure, slow response), but a retry with more patience recovers
  // a real fraction of those — confirmed empirically on real hardware.
  int httpCode = -1;
  for (int attempt = 0; attempt < 2 && httpCode != 200; attempt++) {
    if (attempt > 0) {
      Serial.println("[api] postVoiceCheck: retrying...");
      delay(500);
    }
    HTTPClient http;
    http.begin(String(BACKEND_URL) + "/voice-check");
    http.addHeader("Content-Type", String("multipart/form-data; boundary=") + BOUNDARY);
    http.setConnectTimeout(15000);
    http.setTimeout(15000);

    httpCode = http.POST(body, totalLen);

    if (httpCode == 200) {
      String payload = http.getString();
      JsonDocument doc;
      DeserializationError err = deserializeJson(doc, payload);
      if (!err && !doc["voice_liveness_score"].isNull()) {
        result.ok = true;
        result.voiceLivenessScore = doc["voice_liveness_score"].as<float>();
        result.spoofDetected = doc["spoof_detected"] | false;
      } else {
        Serial.println("[api] postVoiceCheck: response missing voice_liveness_score");
      }
    } else {
      Serial.printf("[api] postVoiceCheck: HTTP %d\n", httpCode);
    }
    http.end();
  }
  free(body);

  return result;
}

RiskScoreResult postRiskScore(float voiceLivenessScore, bool hasTinymlScore, float tinymlLivenessScore) {
  RiskScoreResult result;
  static String riskLevelBuf; // kept alive after return, per api.h contract

  if (!WiFi.isConnected()) {
    Serial.println("[api] postRiskScore: WiFi not connected");
    return result;
  }

  JsonDocument reqDoc;
  reqDoc["voice_liveness_score"] = voiceLivenessScore;
  // face_liveness_score / face_id_match_score / doc_authenticity_score are
  // intentionally omitted, not set to 0 or 1.0 — the backend's fusion logic
  // excludes unevaluated modalities from the weighted average rather than
  // assuming a value for them.
  if (hasTinymlScore) {
    // Informational only on the backend (see utils/scoring.py) — omitted
    // entirely (not sent as 0) when TinyML didn't produce a usable score
    // this cycle, same "omitted means unevaluated" contract as the others.
    reqDoc["tinyml_liveness_score"] = tinymlLivenessScore;
  }
  String reqBody;
  serializeJson(reqDoc, reqBody);

  int httpCode = -1;
  for (int attempt = 0; attempt < 2 && httpCode != 200; attempt++) {
    if (attempt > 0) {
      Serial.println("[api] postRiskScore: retrying...");
      delay(500);
    }
    HTTPClient http;
    http.begin(String(BACKEND_URL) + "/risk-score");
    http.addHeader("Content-Type", "application/json");
    http.setConnectTimeout(15000);
    http.setTimeout(15000);

    httpCode = http.POST(reqBody);

    if (httpCode == 200) {
      String payload = http.getString();
      JsonDocument doc;
      DeserializationError err = deserializeJson(doc, payload);
      if (!err && !doc["risk_level"].isNull()) {
        result.ok = true;
        result.fraudRiskScore = doc["fraud_risk_score"] | 0.0f;
        riskLevelBuf = doc["risk_level"].as<const char *>();
        result.riskLevel = riskLevelBuf.c_str();
      } else {
        Serial.println("[api] postRiskScore: response missing risk_level");
      }
    } else {
      Serial.printf("[api] postRiskScore: HTTP %d\n", httpCode);
    }
    http.end();
  }

  return result;
}
