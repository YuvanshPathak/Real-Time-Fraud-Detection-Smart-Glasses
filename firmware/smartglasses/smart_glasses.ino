/**
 * @file smart_glasses.ino
 * @brief Main firmware sketch — Real-Time Fraud Detection Smart Glasses.
 *
 * Hardware: Seeed Studio XIAO ESP32-S3 Sense
 *   - Built-in OV2640 camera  (JPEG capture via camera.cpp)
 *   - Built-in PDM microphone (16 kHz PCM via microphone.cpp)
 *   - Wi-Fi 802.11 b/g/n
 *   - Onboard LED (alert stand-in for bone conduction speaker)
 *
 * Detection cycle (runs every LOOP_INTERVAL_MS):
 *   1. Capture JPEG frame  → POST /face-check  → face_liveness_score
 *   2. Record 5 s audio    → POST /voice-check → voice_liveness_score
 *   3. POST /risk-score with both scores (id/doc default 1.0) → risk_level
 *   4. Signal verdict via LED blink pattern + Serial output
 *
 * Configure WIFI_SSID, WIFI_PASSWORD, BACKEND_URL in config.h before flashing.
 */

#include <Arduino.h>

#include "config.h"
#include "camera.h"
#include "microphone.h"
#include "wifi.h"
#include "api.h"

// ─── Alert LED helpers ────────────────────────────────────────────────────────

static void ledBlink(int times, int on_ms, int off_ms) {
    for (int i = 0; i < times; i++) {
        digitalWrite(ALERT_LED_PIN, HIGH);
        delay(on_ms);
        digitalWrite(ALERT_LED_PIN, LOW);
        delay(off_ms);
    }
}

/**
 * Visual alert via the onboard LED.
 * Replace / extend with bone conduction driver when hardware is available.
 *
 * SAFE       → 2 short green pulses (LED on = any level, no color distinction)
 * SUSPICIOUS → 4 medium pulses
 * FRAUD      → 10 rapid pulses (alarm pattern)
 */
static void signalVerdict(const char *risk_level) {
    Serial.printf("\n╔══════════════════════════════╗\n");
    Serial.printf("║  VERDICT : %-18s║\n", risk_level);
    Serial.printf("╚══════════════════════════════╝\n\n");

    if (strcmp(risk_level, "SAFE") == 0) {
        ledBlink(2, 150, 150);                // double-beep
    } else if (strcmp(risk_level, "SUSPICIOUS") == 0) {
        ledBlink(4, 200, 200);                // warning pattern
    } else {
        // FRAUD — rapid alarm
        ledBlink(10, 80, 80);
        delay(300);
        ledBlink(3, 400, 200);
    }
}

// ─── Single detection cycle ───────────────────────────────────────────────────

static void runDetectionCycle() {
    Serial.println("========================================");
    Serial.println("[CYCLE] Starting fraud detection cycle...");

    // ── 1. Face check ─────────────────────────────────────────────────────────
    uint8_t *jpeg_buf = NULL;
    size_t   jpeg_len = 0;
    ApiResult face_result = {false, 1.0f};

    if (captureFrame(&jpeg_buf, &jpeg_len)) {
        Serial.printf("[CYCLE] Captured %u byte JPEG → sending to /face-check\n",
                      (unsigned int)jpeg_len);
        face_result = postFaceCheck(jpeg_buf, jpeg_len);
        releaseFrame();   // return buffer to camera driver
    } else {
        Serial.println("[CYCLE] Camera capture failed — using default face score 1.0");
    }

    if (!face_result.ok) {
        Serial.println("[CYCLE] /face-check failed — using default score 1.0");
        face_result.score = 1.0f;
    }
    Serial.printf("[CYCLE] face_liveness_score = %.4f\n", face_result.score);

    // ── 2. Voice check ────────────────────────────────────────────────────────
    int16_t *pcm_buf      = NULL;
    size_t   pcm_samples  = 0;
    ApiResult voice_result = {false, 1.0f};

    if (recordToBuffer(&pcm_buf, &pcm_samples)) {
        Serial.printf("[CYCLE] Recorded %u samples → sending to /voice-check\n",
                      (unsigned int)pcm_samples);
        voice_result = postVoiceCheck(pcm_buf, pcm_samples, SAMPLE_RATE);
        free(pcm_buf);   // caller owns the buffer
        pcm_buf = NULL;
    } else {
        Serial.println("[CYCLE] Mic recording failed — using default voice score 1.0");
    }

    if (!voice_result.ok) {
        Serial.println("[CYCLE] /voice-check failed — using default score 1.0");
        voice_result.score = 1.0f;
    }
    Serial.printf("[CYCLE] voice_liveness_score = %.4f\n", voice_result.score);

    // ── 3. Risk fusion ────────────────────────────────────────────────────────
    // id_score and doc_score default to 1.0 (not checked at the glasses edge)
    // A companion phone app or the frontend can supply these for a full score.
    char risk_level[16] = "UNKNOWN";
    bool risk_ok = postRiskScore(
        face_result.score,
        voice_result.score,
        1.0f,   // face_id_match_score — not available at edge
        1.0f,   // doc_authenticity_score — not available at edge
        risk_level,
        sizeof(risk_level)
    );

    if (!risk_ok) {
        Serial.println("[CYCLE] /risk-score failed — defaulting to SUSPICIOUS");
        strncpy(risk_level, "SUSPICIOUS", sizeof(risk_level));
    }

    // ── 4. Signal verdict ─────────────────────────────────────────────────────
    signalVerdict(risk_level);
}

// ─── Arduino lifecycle ────────────────────────────────────────────────────────

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n====================================");
    Serial.println("  Fraud Detection Smart Glasses");
    Serial.println("  XIAO ESP32-S3 Sense — Firmware");
    Serial.println("====================================\n");

    // Alert LED
    pinMode(ALERT_LED_PIN, OUTPUT);
    digitalWrite(ALERT_LED_PIN, LOW);

    // Wi-Fi
    if (!connectWifi()) {
        Serial.println("[SETUP] Wi-Fi failed. Halting.");
        while (true) {
            ledBlink(1, 500, 500);  // slow blink = error
        }
    }

    // Camera
    if (!initCamera()) {
        Serial.println("[SETUP] Camera init failed. Halting.");
        while (true) {
            ledBlink(2, 200, 800);
        }
    }

    // Microphone
    if (!initMicrophone()) {
        Serial.println("[SETUP] Microphone init failed. Halting.");
        while (true) {
            ledBlink(3, 200, 800);
        }
    }

    Serial.println("\n[SETUP] All systems ready. Starting detection loop.\n");

    // Ready signal: 3 quick pulses
    ledBlink(3, 100, 100);
}

void loop() {
    maintainWifi();        // reconnect if link dropped
    runDetectionCycle();   // capture → analyse → signal
    Serial.printf("[LOOP] Cycle complete. Waiting %d ms...\n\n", LOOP_INTERVAL_MS);
    delay(LOOP_INTERVAL_MS);
}
