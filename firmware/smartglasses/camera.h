#ifndef CAMERA_H
#define CAMERA_H

#include <stdint.h>
#include <stddef.h>

/**
 * @brief Initialize the OV2640 camera on the XIAO ESP32-S3 Sense.
 *
 * Configures the camera in JPEG mode at QVGA resolution (320×240).
 * Call once in setup().  Returns true on success.
 */
bool initCamera();

/**
 * @brief Capture a single JPEG frame.
 *
 * Fills *out_buf with a pointer to the JPEG byte data and *out_len with the
 * byte length.  The returned buffer is owned by the camera frame-buffer system;
 * YOU MUST call releaseFrame() after you are done with the data.
 *
 * @param out_buf Pointer to the JPEG buffer (set on success).
 * @param out_len Byte length of the JPEG data (set on success).
 * @return true if a frame was captured successfully.
 */
bool captureFrame(uint8_t **out_buf, size_t *out_len);

/**
 * @brief Return the camera frame buffer to the driver.
 *
 * Must be called after every successful captureFrame() once you are done
 * reading the data.  Failing to call this leaks frame buffers.
 */
void releaseFrame();

#endif
