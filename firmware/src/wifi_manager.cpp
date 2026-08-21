#include "wifi_manager.h"
#include "config.h"

#include <Arduino.h>
#include <WiFi.h>

static const char *statusToString(wl_status_t status) {
  switch (status) {
    case WL_NO_SSID_AVAIL: return "WL_NO_SSID_AVAIL (SSID not found — check spelling/range)";
    case WL_CONNECT_FAILED: return "WL_CONNECT_FAILED (usually wrong password, or auth type unsupported)";
    case WL_CONNECTION_LOST: return "WL_CONNECTION_LOST";
    case WL_DISCONNECTED: return "WL_DISCONNECTED";
    case WL_IDLE_STATUS: return "WL_IDLE_STATUS";
    case WL_SCAN_COMPLETED: return "WL_SCAN_COMPLETED";
    case WL_CONNECTED: return "WL_CONNECTED";
    default: return "unknown";
  }
}

bool connectWifi(unsigned long timeoutMs) {
  Serial.printf("[wifi] connecting to %s\n", WIFI_SSID);

  // Clear any in-progress attempt from a previous call before starting a new
  // one — without this, a retry after a timed-out attempt throws "STA clear
  // config failed! ESP_ERR_WIFI_STATE" because the driver is still mid-attempt.
  // NOTE: disconnect(true, ...) (wifioff=true) turns the radio fully off and
  // then the next begin() fails with ESP_ERR_WIFI_NOT_STARTED — confirmed by
  // trying it. Plain disconnect() clears the attempt without that problem.
  WiFi.disconnect();
  delay(500); // let the driver fully unwind a previous in-progress attempt

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  wl_status_t lastStatus = WL_IDLE_STATUS;
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > timeoutMs) {
      Serial.printf("\n[wifi] connect timed out, last status: %s\n", statusToString(WiFi.status()));
      return false;
    }
    wl_status_t status = WiFi.status();
    if (status != lastStatus) {
      Serial.printf("\n[wifi] status changed: %s\n", statusToString(status));
      lastStatus = status;
    }
    delay(250);
    Serial.print(".");
  }

  Serial.printf("\n[wifi] connected, IP: %s\n", WiFi.localIP().toString().c_str());
  return true;
}

bool isWifiConnected() {
  return WiFi.status() == WL_CONNECTED;
}
