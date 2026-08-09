/**
 * @file storage.cpp
 * @brief Local file helpers for XIAO ESP32-S3 Sense.
 *
 * Currently provides WAV-to-SD save capability as a debug tool.
 * Not required for the core upload pipeline (api.cpp handles in-memory WAV).
 * Included as a placeholder for future SD card logging or TinyML model storage.
 */

#include <Arduino.h>
#include "storage.h"

// ─── SD Card Save (optional debug helper) ────────────────────────────────────
// Uncomment and fill if you attach a MicroSD card to the XIAO ESP32-S3 Sense.

// #include <SD.h>
// #define SD_CS_PIN  D2

// bool saveWavToSD(const char *filename, const int16_t *pcm_buf,
//                  size_t pcm_samples, uint32_t sample_rate) {
//     if (!SD.begin(SD_CS_PIN)) {
//         Serial.println("[SD] Card mount failed.");
//         return false;
//     }
//     File f = SD.open(filename, FILE_WRITE);
//     if (!f) { Serial.printf("[SD] Cannot open %s\n", filename); return false; }
//
//     uint32_t pcm_bytes   = pcm_samples * sizeof(int16_t);
//     uint32_t byte_rate   = sample_rate * 2;
//     uint32_t riff_size   = 36 + pcm_bytes;
//     // … write 44-byte WAV header then PCM data …
//     f.close();
//     return true;
// }
