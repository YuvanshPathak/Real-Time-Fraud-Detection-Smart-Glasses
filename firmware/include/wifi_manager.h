#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

// Blocks until Wi-Fi connects or timeoutMs elapses. Returns true on success.
bool connectWifi(unsigned long timeoutMs = 15000);

// True if currently connected.
bool isWifiConnected();

#endif
