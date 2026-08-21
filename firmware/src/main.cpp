// Real-Time Fraud Detection Smart Glasses — voice module only (this phase).
//
// Flow: connect Wi-Fi -> init PDM mic -> loop { record 5s -> POST /voice-check
// -> POST /risk-score with voice_liveness_score only -> LED verdict }.
//
// Camera, face/document checks, and the phone Gateway relay are out of scope
// for this rebuild — see CLAUDE.md "Current build status" for what's real.

#include <Arduino.h>
#include <WiFi.h>

#include "api.h"
#include "config.h"
#include "microphone.h"
#include "wifi_manager.h"

static void blinkLed(int times, int onMs, int offMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(ALERT_LED_PIN, HIGH);
    delay(onMs);
    digitalWrite(ALERT_LED_PIN, LOW);
    if (i < times - 1) delay(offMs);
  }
}

// Single onboard LED, so severity is encoded as blink count/speed rather
// than color: SAFE = one slow blink, SUSPICIOUS = three medium blinks,
// FRAUD = five fast blinks.
static void showVerdict(const char *riskLevel) {
  if (strcmp(riskLevel, "SAFE") == 0) {
    blinkLed(1, 600, 0);
  } else if (strcmp(riskLevel, "SUSPICIOUS") == 0) {
    blinkLed(3, 250, 200);
  } else if (strcmp(riskLevel, "FRAUD") == 0) {
    blinkLed(5, 100, 100);
  } else {
    // Unrecognized/empty risk level — distinct pattern so it's visibly
    // different from a real verdict, not silently treated as SAFE.
    blinkLed(2, 800, 400);
  }
}

static bool micReady = false;

void setup() {
  Serial.begin(115200);
  delay(1500); // let native USB CDC settle before the first prints
  Serial.println("\n[boot] Real-Time Fraud Detection Smart Glasses — voice module");

  pinMode(ALERT_LED_PIN, OUTPUT);
  digitalWrite(ALERT_LED_PIN, LOW);

  Serial.printf("[boot] PSRAM found: %s, size: %u bytes\n", psramFound() ? "yes" : "no", ESP.getPsramSize());

  // TEMPORARY DIAGNOSTIC — remove once Wi-Fi connects reliably. Reports the
  // actual encryption type of nearby networks so we can tell a wrong
  // password apart from an auth type WiFi.begin(ssid, password) can't do
  // at all (e.g. WPA2-Enterprise, which needs a username too).
  Serial.println("[boot] scanning for WIFI_SSID...");
  int n = WiFi.scanNetworks();
  for (int i = 0; i < n; i++) {
    if (WiFi.SSID(i) == String(WIFI_SSID)) {
      wifi_auth_mode_t enc = WiFi.encryptionType(i);
      const char *encName = "unknown";
      switch (enc) {
        case WIFI_AUTH_OPEN: encName = "OPEN"; break;
        case WIFI_AUTH_WEP: encName = "WEP"; break;
        case WIFI_AUTH_WPA_PSK: encName = "WPA_PSK"; break;
        case WIFI_AUTH_WPA2_PSK: encName = "WPA2_PSK"; break;
        case WIFI_AUTH_WPA_WPA2_PSK: encName = "WPA_WPA2_PSK"; break;
        case WIFI_AUTH_WPA2_ENTERPRISE: encName = "WPA2_ENTERPRISE (needs username, not just password!)"; break;
        case WIFI_AUTH_WPA3_PSK: encName = "WPA3_PSK"; break;
        default: break;
      }
      Serial.printf("[boot] found %s: RSSI=%d encryption=%s\n", WIFI_SSID, WiFi.RSSI(i), encName);
    }
  }
  if (n == 0) Serial.println("[boot] scan found no networks at all");

  if (!connectWifi()) {
    Serial.println("[boot] Wi-Fi connect failed — will retry each cycle");
  }

  micReady = initMicrophone();
  if (!micReady) {
    Serial.println("[boot] Microphone init failed — voice checks will be skipped");
  }
}

void loop() {
  if (!isWifiConnected()) {
    Serial.println("[loop] Wi-Fi not connected, retrying...");
    connectWifi();
    delay(LOOP_INTERVAL_MS);
    return;
  }

  if (!micReady) {
    Serial.println("[loop] Microphone not ready, retrying init...");
    micReady = initMicrophone();
    delay(LOOP_INTERVAL_MS);
    return;
  }

  Serial.println("[loop] recording...");
  size_t sampleCount = 0;
  int16_t *samples = recordToBuffer(&sampleCount);
  if (!samples || sampleCount == 0) {
    Serial.println("[loop] recording failed, skipping cycle");
    if (samples) free(samples);
    delay(LOOP_INTERVAL_MS);
    return;
  }
  Serial.printf("[loop] captured %u samples\n", (unsigned)sampleCount);

  VoiceCheckResult voiceRes = postVoiceCheck(samples, sampleCount, SAMPLE_RATE);
  free(samples);

  if (!voiceRes.ok) {
    Serial.println("[loop] /voice-check failed, skipping this cycle's verdict");
    delay(LOOP_INTERVAL_MS);
    return;
  }
  Serial.printf("[loop] voice_liveness_score=%.2f spoof_detected=%s\n",
                voiceRes.voiceLivenessScore, voiceRes.spoofDetected ? "true" : "false");

  RiskScoreResult riskRes = postRiskScore(voiceRes.voiceLivenessScore);
  if (!riskRes.ok) {
    Serial.println("[loop] /risk-score failed, skipping verdict display");
    delay(LOOP_INTERVAL_MS);
    return;
  }
  Serial.printf("[loop] fraud_risk_score=%.2f risk_level=%s\n", riskRes.fraudRiskScore, riskRes.riskLevel);

  showVerdict(riskRes.riskLevel);

  delay(LOOP_INTERVAL_MS);
}
