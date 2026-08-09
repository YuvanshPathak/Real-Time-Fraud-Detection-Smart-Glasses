#ifndef CONFIG_H
#define CONFIG_H

// ─── Wi-Fi Credentials ────────────────────────────────────────────────────────
// Edit these before flashing.  For demo use ngrok: "https://xxxx.ngrok.io"
#define WIFI_SSID      "YourNetworkSSID"
#define WIFI_PASSWORD  "YourNetworkPassword"

// ─── Backend Base URL ─────────────────────────────────────────────────────────
// No trailing slash.  Use ngrok URL during demo if backend runs on localhost.
#define BACKEND_URL    "http://192.168.1.100:8000"

// ─── Audio ────────────────────────────────────────────────────────────────────
#define SAMPLE_RATE        16000
#define RECORD_SECONDS     5

// ─── PDM Microphone Pins (XIAO ESP32-S3 Sense) ───────────────────────────────
#define MIC_DATA_PIN       GPIO_NUM_41
#define MIC_CLK_PIN        GPIO_NUM_42

// ─── Alert LED (onboard LED on XIAO ESP32-S3) ────────────────────────────────
// Used as a visual stand-in for the bone conduction speaker.
#define ALERT_LED_PIN      21

// ─── Timing ───────────────────────────────────────────────────────────────────
// Milliseconds to wait between each detection cycle.
#define LOOP_INTERVAL_MS   10000

#endif