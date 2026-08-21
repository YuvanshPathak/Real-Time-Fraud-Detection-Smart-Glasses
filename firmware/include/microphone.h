#ifndef MICROPHONE_H
#define MICROPHONE_H

#include <cstddef>
#include <cstdint>

// Initializes the onboard PDM microphone (XIAO ESP32-S3 Sense).
// Returns true on success.
bool initMicrophone();

// Blocks for RECORD_SECONDS, recording mono 16-bit PCM at SAMPLE_RATE into a
// PSRAM-backed buffer. Caller owns the returned buffer and must free() it.
// Returns nullptr on allocation or read failure; *outSamples is set to the
// number of int16_t samples actually captured.
int16_t *recordToBuffer(size_t *outSamples);

#endif
