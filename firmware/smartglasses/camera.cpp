/**
 * @file camera.cpp
 * @brief OV2640 camera driver for Seeed Studio XIAO ESP32-S3 Sense.
 *
 * Uses the esp_camera library (bundled with the ESP32 Arduino Core).
 * Pin mapping is fixed for the XIAO ESP32-S3 Sense board.
 * Captures JPEG frames at QVGA (320x240) — good balance of quality vs speed.
 */

#include <Arduino.h>
#include <esp_camera.h>

#include "camera.h"

// ─── XIAO ESP32-S3 Sense — OV2640 Pin Mapping ────────────────────────────────
// Do NOT change these; they are hard-wired on the Seeed module.
#define CAM_PIN_PWDN    -1
#define CAM_PIN_RESET   -1
#define CAM_PIN_XCLK    10
#define CAM_PIN_SIOD    40   // SDA
#define CAM_PIN_SIOC    39   // SCL
#define CAM_PIN_Y9      48
#define CAM_PIN_Y8      11
#define CAM_PIN_Y7      12
#define CAM_PIN_Y6      14
#define CAM_PIN_Y5      16
#define CAM_PIN_Y4      18
#define CAM_PIN_Y3      17
#define CAM_PIN_Y2      15
#define CAM_PIN_VSYNC   38
#define CAM_PIN_HREF    47
#define CAM_PIN_PCLK    13

// Internal state
static bool            cam_initialized = false;
static camera_fb_t    *current_fb      = NULL;   // frame buffer currently in use

/**
 * @brief Initialize the OV2640 camera in JPEG/QVGA mode.
 */
bool initCamera() {
    if (cam_initialized) return true;

    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer   = LEDC_TIMER_0;
    config.pin_d0       = CAM_PIN_Y2;
    config.pin_d1       = CAM_PIN_Y3;
    config.pin_d2       = CAM_PIN_Y4;
    config.pin_d3       = CAM_PIN_Y5;
    config.pin_d4       = CAM_PIN_Y6;
    config.pin_d5       = CAM_PIN_Y7;
    config.pin_d6       = CAM_PIN_Y8;
    config.pin_d7       = CAM_PIN_Y9;
    config.pin_xclk     = CAM_PIN_XCLK;
    config.pin_pclk     = CAM_PIN_PCLK;
    config.pin_vsync    = CAM_PIN_VSYNC;
    config.pin_href     = CAM_PIN_HREF;
    config.pin_sccb_sda = CAM_PIN_SIOD;
    config.pin_sccb_scl = CAM_PIN_SIOC;
    config.pin_pwdn     = CAM_PIN_PWDN;
    config.pin_reset    = CAM_PIN_RESET;

    config.xclk_freq_hz = 20000000;       // 20 MHz XCLK
    config.pixel_format = PIXFORMAT_JPEG; // compressed output
    config.frame_size   = FRAMESIZE_QVGA; // 320 × 240
    config.jpeg_quality = 12;             // 0–63, lower = higher quality
    config.fb_count     = 1;              // single frame buffer (no PSRAM burst)
    config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
    config.fb_location  = CAMERA_FB_IN_PSRAM; // store frame in PSRAM if available

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[CAM] esp_camera_init failed: 0x%x\n", err);
        return false;
    }

    // Tune sensor settings for indoor / close-range face capture
    sensor_t *s = esp_camera_sensor_get();
    if (s) {
        s->set_brightness(s, 1);   // slight brightness boost
        s->set_saturation(s, -1);  // reduce saturation (cleaner for liveness)
        s->set_whitebal(s, 1);     // auto white balance on
        s->set_awb_gain(s, 1);
        s->set_exposure_ctrl(s, 1); // auto exposure on
    }

    cam_initialized = true;
    Serial.println("[CAM] OV2640 initialized (QVGA JPEG).");
    return true;
}

/**
 * @brief Capture one JPEG frame and return a pointer to its byte data.
 *
 * The pointer is valid until releaseFrame() is called.
 */
bool captureFrame(uint8_t **out_buf, size_t *out_len) {
    if (!out_buf || !out_len) return false;
    *out_buf = NULL;
    *out_len = 0;

    if (!cam_initialized) {
        Serial.println("[CAM] Not initialized. Call initCamera() first.");
        return false;
    }

    // Release any previously held frame buffer before capturing a new one
    if (current_fb) {
        esp_camera_fb_return(current_fb);
        current_fb = NULL;
    }

    current_fb = esp_camera_fb_get();
    if (!current_fb) {
        Serial.println("[CAM] esp_camera_fb_get() returned NULL.");
        return false;
    }

    Serial.printf("[CAM] Frame captured: %u bytes.\n", (unsigned int)current_fb->len);
    *out_buf = current_fb->buf;
    *out_len = current_fb->len;
    return true;
}

/**
 * @brief Return the frame buffer to the camera driver.
 */
void releaseFrame() {
    if (current_fb) {
        esp_camera_fb_return(current_fb);
        current_fb = NULL;
    }
}
