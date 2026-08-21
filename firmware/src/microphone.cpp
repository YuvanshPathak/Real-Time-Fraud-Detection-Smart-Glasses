#include "microphone.h"
#include "config.h"

#include <Arduino.h>
#include <driver/i2s_pdm.h>
#include <esp_heap_caps.h>

static i2s_chan_handle_t rx_handle = nullptr;

bool initMicrophone() {
  i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_AUTO, I2S_ROLE_MASTER);
  if (i2s_new_channel(&chan_cfg, nullptr, &rx_handle) != ESP_OK) {
    Serial.println("[mic] i2s_new_channel failed");
    return false;
  }

  i2s_pdm_rx_config_t pdm_rx_cfg = {
    .clk_cfg = I2S_PDM_RX_CLK_DEFAULT_CONFIG(SAMPLE_RATE),
    .slot_cfg = I2S_PDM_RX_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO),
    .gpio_cfg = {
      .clk = MIC_CLK_PIN,
      .din = MIC_DATA_PIN,
      .invert_flags = {
        .clk_inv = false,
      },
    },
  };

  if (i2s_channel_init_pdm_rx_mode(rx_handle, &pdm_rx_cfg) != ESP_OK) {
    Serial.println("[mic] i2s_channel_init_pdm_rx_mode failed");
    return false;
  }

  if (i2s_channel_enable(rx_handle) != ESP_OK) {
    Serial.println("[mic] i2s_channel_enable failed");
    return false;
  }

  Serial.println("[mic] initialized");
  return true;
}

int16_t *recordToBuffer(size_t *outSamples) {
  *outSamples = 0;

  const size_t numSamples = (size_t)SAMPLE_RATE * RECORD_SECONDS;
  const size_t bufBytes = numSamples * sizeof(int16_t);

  // PSRAM-preferring allocation — a 5s 16kHz mono buffer is ~160KB, which
  // exceeds what's safe to take from internal SRAM (~270KB total, shared
  // with the rest of the app and the later HTTP body buffer). Confirmed
  // deterministic malloc failure with plain malloc() last phase.
  int16_t *buf = (int16_t *)heap_caps_malloc(bufBytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (!buf) {
    Serial.println("[mic] PSRAM allocation failed, falling back to SRAM");
    buf = (int16_t *)malloc(bufBytes);
  }
  if (!buf) {
    Serial.println("[mic] recordToBuffer: allocation failed entirely");
    return nullptr;
  }

  size_t totalRead = 0;
  uint8_t *writePtr = (uint8_t *)buf;
  while (totalRead < bufBytes) {
    size_t bytesRead = 0;
    esp_err_t err = i2s_channel_read(rx_handle, writePtr + totalRead, bufBytes - totalRead, &bytesRead, portMAX_DELAY);
    if (err != ESP_OK) {
      Serial.printf("[mic] i2s_channel_read failed: %d\n", err);
      break;
    }
    totalRead += bytesRead;
  }

  *outSamples = totalRead / sizeof(int16_t);
  return buf;
}
