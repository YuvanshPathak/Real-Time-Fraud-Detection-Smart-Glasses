#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

/**
 * @brief Connect to the Wi-Fi AP defined by WIFI_SSID / WIFI_PASSWORD in config.h.
 *
 * Blocks until connected or timeout (20 s).
 * Returns true if connected, false on timeout.
 */
bool connectWifi();

/**
 * @brief Return true if Wi-Fi is currently connected.
 */
bool isWifiConnected();

/**
 * @brief Attempt reconnection if the link has dropped.
 *
 * Call this at the top of loop() to keep the connection alive.
 */
void maintainWifi();

#endif
