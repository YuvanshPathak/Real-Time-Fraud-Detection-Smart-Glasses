#ifndef MICROPHONE_H
#define MICROPHONE_H

#include <stdint.h>
#include <stddef.h>

/** Initialize the PDM microphone driver. Returns true on success. */
bool initMicrophone();

/** Record audio and print stats to Serial (debug helper). */
void recordMicrophone();

/**
 * Record audio into a caller-allocated heap buffer.
 * On success, *out_buf points to a malloc'd int16_t array of *out_samples samples.
 * Caller is responsible for free(*out_buf).
 * Returns true on success.
 */
bool recordToBuffer(int16_t **out_buf, size_t *out_samples);

#endif