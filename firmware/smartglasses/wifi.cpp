/**
 * @file wifi.cpp
 * @brief Wi-Fi connection manager for XIAO ESP32-S3 Sense.
 */

#include <Arduino.h>
#include <WiFi.h>

#include "config.h"
#include "wifi.h"

// Connection timeout (milliseconds)
static const uint32_t WIFI_TIMEOUT_MS = 20000;

/**
 * @brief Connect to the Wi-Fi network.  Blocks up to WIFI_TIMEOUT_MS.
 */
bool connectWifi() {
    if (WiFi.status() == WL_CONNECTED) return true;

    Serial.printf("[WIFI] Connecting to '%s'", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - start > WIFI_TIMEOUT_MS) {
            Serial.println("\n[WIFI] Connection timed out!");
            return false;
        }
        Serial.print(".");
        delay(500);
    }

    Serial.printf("\n[WIFI] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    return true;
}

/**
 * @brief Return true if Wi-Fi is currently connected.
 */
bool isWifiConnected() {
    return WiFi.status() == WL_CONNECTED;
}

/**
 * @brief Re-connect if the link dropped.  Call at the top of loop().
 */
void maintainWifi() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WIFI] Connection lost — reconnecting...");
        WiFi.disconnect();
        connectWifi();
    }
}
