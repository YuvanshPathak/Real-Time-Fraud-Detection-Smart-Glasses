/**
 * @file microphone.cpp
 * @brief ESP32 Arduino Core 3.x PDM Microphone driver implementation for Seeed Studio XIAO ESP32-S3 Sense.
 */

#include <Arduino.h>
#include <driver/i2s_pdm.h>
#include <esp_heap_caps.h>

#include "config.h"
#include "microphone.h"

// Internal static handles to manage I2S PDM Rx channel state
static i2s_chan_handle_t rx_handle = NULL;
static bool is_initialized = false;

/**
 * @brief Initialize the onboard PDM microphone using ESP32 Arduino Core 3.x I2S/PDM driver.
 * 
 * Configures I2S in Master RX PDM mode for 16 kHz Mono, 16-bit PCM audio capture.
 * Uses GPIO41 (DATA) and GPIO42 (CLK) defined in config.h.
 * 
 * @return true if initialization succeeded, false otherwise.
 */
bool initMicrophone() {
    if (is_initialized) {
        return true;
    }

    // 1. Configure I2S Channel in Master Role for Audio RX
    i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_AUTO, I2S_ROLE_MASTER);
    esp_err_t err = i2s_new_channel(&chan_cfg, NULL, &rx_handle);
    if (err != ESP_OK) {
        Serial.printf("[MIC] Failed to allocate I2S channel (Error: 0x%x)\n", err);
        return false;
    }

    // 2. Configure PDM RX Clock, Slot (16-bit Mono PCM), and Pin Mapping (GPIO41 / GPIO42)
    i2s_pdm_rx_config_t pdm_rx_cfg = {
        .clk_cfg = I2S_PDM_RX_CLK_DEFAULT_CONFIG((uint32_t)SAMPLE_RATE),
        .slot_cfg = I2S_PDM_RX_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO),
        .gpio_cfg = {
            .clk = (gpio_num_t)MIC_CLK_PIN,
            .din = (gpio_num_t)MIC_DATA_PIN,
            .invert_flags = {
                .clk_inv = false,
            },
        },
    };

    // 3. Initialize PDM RX mode on the allocated channel
    err = i2s_channel_init_pdm_rx_mode(rx_handle, &pdm_rx_cfg);
    if (err != ESP_OK) {
        Serial.printf("[MIC] Failed to init PDM RX mode (Error: 0x%x)\n", err);
        i2s_del_channel(rx_handle);
        rx_handle = NULL;
        return false;
    }

    // 4. Enable the I2S PDM RX Channel
    err = i2s_channel_enable(rx_handle);
    if (err != ESP_OK) {
        Serial.printf("[MIC] Failed to enable I2S RX channel (Error: 0x%x)\n", err);
        i2s_del_channel(rx_handle);
        rx_handle = NULL;
        return false;
    }

    is_initialized = true;
    Serial.println("[MIC] PDM Microphone initialized successfully (16 kHz, Mono, 16-bit PCM).");
    return true;
}

/**
 * @brief Record 5 seconds of 16 kHz 16-bit PCM audio into RAM and display audio statistics.
 * 
 * Safely allocates memory (preferring PSRAM if available), reads audio samples from I2S PDM,
 * computes min, max, average absolute amplitude statistics, and frees memory.
 */
void recordMicrophone() {
    // Ensure microphone driver is initialized before recording
    if (!is_initialized) {
        Serial.println("[MIC] Driver not initialized. Attempting auto-initialization...");
        if (!initMicrophone()) {
            Serial.println("[MIC] Recording aborted: Initialization failed.");
            return;
        }
    }

    // Calculate total 16-bit samples for RECORD_SECONDS (5s @ 16kHz = 80,000 samples = 160,000 bytes)
    size_t total_samples = (size_t)SAMPLE_RATE * (size_t)RECORD_SECONDS;
    size_t buffer_size_bytes = total_samples * sizeof(int16_t);

    // Safely allocate RAM for audio buffer (prefer PSRAM if available, fallback to internal SRAM)
    int16_t *audio_buffer = NULL;
    if (psramFound()) {
        audio_buffer = (int16_t *)heap_caps_malloc(buffer_size_bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    }
    if (audio_buffer == NULL) {
        audio_buffer = (int16_t *)malloc(buffer_size_bytes);
    }

    if (audio_buffer == NULL) {
        Serial.printf("[MIC] Memory allocation failed! Could not allocate %u bytes.\n", (unsigned int)buffer_size_bytes);
        return;
    }

    Serial.printf("[MIC] Recording %d seconds of audio (%u samples / %u bytes)...\n", 
                  RECORD_SECONDS, (unsigned int)total_samples, (unsigned int)buffer_size_bytes);

    size_t bytes_read = 0;
    size_t total_bytes_read = 0;
    uint8_t *byte_ptr = (uint8_t *)audio_buffer;

    // Stream audio data from PDM RX I2S channel into the buffer
    while (total_bytes_read < buffer_size_bytes) {
        size_t bytes_to_read = buffer_size_bytes - total_bytes_read;
        esp_err_t err = i2s_channel_read(rx_handle, byte_ptr + total_bytes_read, bytes_to_read, &bytes_read, pdMS_TO_TICKS(1000));
        
        if (err != ESP_OK) {
            Serial.printf("[MIC] Read error encountered: 0x%x\n", err);
            break;
        }
        if (bytes_read == 0) {
            Serial.println("[MIC] Warning: Read 0 bytes from I2S channel.");
            break;
        }
        total_bytes_read += bytes_read;
    }

    size_t actual_samples = total_bytes_read / sizeof(int16_t);

    if (actual_samples == 0) {
        Serial.println("[MIC] Recording failed: 0 samples captured.");
        free(audio_buffer);
        return;
    }

    // Compute sample statistics: Min, Max, and Average Absolute Amplitude
    int16_t min_sample = audio_buffer[0];
    int16_t max_sample = audio_buffer[0];
    uint64_t abs_sum = 0;

    for (size_t i = 0; i < actual_samples; i++) {
        int16_t sample = audio_buffer[i];
        if (sample < min_sample) min_sample = sample;
        if (sample > max_sample) max_sample = sample;
        abs_sum += (uint64_t)abs((int)sample);
    }

    float avg_abs_amp = (float)abs_sum / (float)actual_samples;

    // Print requested audio stats cleanly to Serial Console
    Serial.println("========================================");
    Serial.println("      PDM MICROPHONE RECORDING STATS    ");
    Serial.println("========================================");
    Serial.printf(" Number of Samples        : %u\n", (unsigned int)actual_samples);
    Serial.printf(" Minimum Sample           : %d\n", min_sample);
    Serial.printf(" Maximum Sample           : %d\n", max_sample);
    Serial.printf(" Average Absolute Amplitude: %.2f\n", avg_abs_amp);
    Serial.println("========================================");

    // Safely free allocated audio memory
    free(audio_buffer);
}

/**
 * @brief Record audio into a caller-owned heap buffer for upstream use (e.g. HTTP upload).
 *
 * Allocates memory (PSRAM preferred), fills it from the I2S PDM RX channel, and
 * returns a pointer + sample count to the caller. The caller MUST free(*out_buf).
 *
 * @param out_buf     Output: pointer to the allocated int16_t audio buffer.
 * @param out_samples Output: count of valid 16-bit samples recorded.
 * @return true if recording succeeded and buffer contains audio data.
 */
bool recordToBuffer(int16_t **out_buf, size_t *out_samples) {
    if (!out_buf || !out_samples) return false;
    *out_buf     = NULL;
    *out_samples = 0;

    if (!is_initialized) {
        Serial.println("[MIC] Auto-initializing for recordToBuffer...");
        if (!initMicrophone()) {
            Serial.println("[MIC] recordToBuffer: init failed.");
            return false;
        }
    }

    size_t total_samples     = (size_t)SAMPLE_RATE * (size_t)RECORD_SECONDS;
    size_t buffer_size_bytes = total_samples * sizeof(int16_t);

    int16_t *buf = NULL;
    if (psramFound()) {
        buf = (int16_t *)heap_caps_malloc(buffer_size_bytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    }
    if (!buf) {
        buf = (int16_t *)malloc(buffer_size_bytes);
    }
    if (!buf) {
        Serial.printf("[MIC] recordToBuffer: malloc %u bytes failed.\n",
                      (unsigned int)buffer_size_bytes);
        return false;
    }

    Serial.printf("[MIC] Recording %d s into buffer (%u bytes)...\n",
                  RECORD_SECONDS, (unsigned int)buffer_size_bytes);

    size_t total_read = 0;
    uint8_t *byte_ptr = (uint8_t *)buf;
    while (total_read < buffer_size_bytes) {
        size_t bytes_read = 0;
        esp_err_t err = i2s_channel_read(rx_handle,
                                          byte_ptr + total_read,
                                          buffer_size_bytes - total_read,
                                          &bytes_read,
                                          pdMS_TO_TICKS(1000));
        if (err != ESP_OK || bytes_read == 0) {
            Serial.printf("[MIC] recordToBuffer: read error 0x%x\n", err);
            break;
        }
        total_read += bytes_read;
    }

    size_t samples_captured = total_read / sizeof(int16_t);
    if (samples_captured == 0) {
        Serial.println("[MIC] recordToBuffer: 0 samples captured.");
        free(buf);
        return false;
    }

    Serial.printf("[MIC] Captured %u samples.\n", (unsigned int)samples_captured);
    *out_buf     = buf;
    *out_samples = samples_captured;
    return true;
}
