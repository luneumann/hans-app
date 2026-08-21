/**
 * Sparrow Sensor Firmware
 * ESP8266 + BME280 + BH1750 → Supabase sensor_readings via HTTPS POST
 *
 * Board: ESP8266 (e.g. Wemos D1 Mini)
 * Libraries: ESP8266WiFi, ESP8266HTTPClient, WiFiClientSecure,
 *            ArduinoJson, Adafruit_BME280, Adafruit_Sensor, BH1750
 *
 * Sensors on the I2C bus:
 *   BME280  →  temperature, humidity, pressure
 *   BH1750  →  illuminance (lux)
 *
 * Before flashing: copy secrets.example.h to secrets.h and fill it in.
 * secrets.h is git-ignored and holds the Wi-Fi, device and Supabase values.
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <Adafruit_Sensor.h>
#include <BH1750.h>

#include "secrets.h"   // WIFI_SSID, WIFI_PASSWORD, SPARROW_ID,
                       // SUPABASE_URL, SUPABASE_ANON_KEY — not committed

// ─── Configuration ────────────────────────────────────────────────────────────

// Deep sleep duration in microseconds (5 minutes)
#define SLEEP_INTERVAL_US (5UL * 60UL * 1000000UL)

// WiFi connect timeout in milliseconds
#define WIFI_TIMEOUT_MS  20000

// ─── Globals ──────────────────────────────────────────────────────────────────

Adafruit_BME280 bme;
BH1750 lightMeter;
bool hasLight = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

bool connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > WIFI_TIMEOUT_MS) return false;
    delay(200);
  }
  return true;
}

/**
 * POST a single metric to Supabase sensor_readings.
 * Returns HTTP status code, or -1 on connection failure.
 */
int postReading(WiFiClientSecure& client, const char* metric, float value) {
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/sensor_readings";

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
  // Prefer=return=minimal avoids fetching the inserted row (saves bandwidth)
  http.addHeader("Prefer", "return=minimal");

  StaticJsonDocument<128> doc;
  doc["sparrow_id"] = SPARROW_ID;
  doc["metric"]     = metric;
  doc["value"]      = value;
  // recorded_at intentionally omitted — Supabase default now() is used

  String body;
  serializeJson(doc, body);

  int status = http.POST(body);
  http.end();
  return status;
}

// ─── Setup (runs once per wake cycle) ────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(100);

  // ── BME280 init ──────────────────────────────────────────────────────────
  Wire.begin();
  if (!bme.begin(0x76)) {
    // Try alternate address
    if (!bme.begin(0x77)) {
      Serial.println("[BME280] Not found — sleeping");
      ESP.deepSleep(SLEEP_INTERVAL_US);
      return;
    }
  }

  // Forced mode: single measurement, then sensor sleeps automatically
  bme.setSampling(
    Adafruit_BME280::MODE_FORCED,
    Adafruit_BME280::SAMPLING_X1,  // temperature
    Adafruit_BME280::SAMPLING_X1,  // pressure
    Adafruit_BME280::SAMPLING_X1,  // humidity
    Adafruit_BME280::FILTER_OFF
  );

  // Wait for the forced measurement to complete (~10 ms)
  while (bme.isMeasuring()) delay(10);

  float temperature = bme.readTemperature();    // °C
  float humidity    = bme.readHumidity();       // %RH
  float pressure    = bme.readPressure() / 100.0f; // hPa

  Serial.printf("[BME280] temp=%.2f°C  hum=%.2f%%  pres=%.2fhPa\n",
                temperature, humidity, pressure);

  // ── BH1750 init (illuminance / lux) ──────────────────────────────────────
  // Default I2C address 0x23 (ADD pin low). Try 0x5C if your board uses it.
  if (lightMeter.begin(BH1750::ONE_TIME_HIGH_RES_MODE, 0x23)) {
    hasLight = true;
  } else if (lightMeter.begin(BH1750::ONE_TIME_HIGH_RES_MODE, 0x5C)) {
    hasLight = true;
  } else {
    Serial.println("[BH1750] Not found — skipping light reading");
  }

  float light = NAN;
  if (hasLight) {
    // ONE_TIME_HIGH_RES takes ~120 ms to complete
    delay(180);
    light = lightMeter.readLightLevel();        // lux
    Serial.printf("[BH1750] light=%.1f lx\n", light);
  }

  // ── WiFi ─────────────────────────────────────────────────────────────────
  if (!connectWiFi()) {
    Serial.println("[WiFi] Connect timeout — sleeping");
    ESP.deepSleep(SLEEP_INTERVAL_US);
    return;
  }
  Serial.printf("[WiFi] Connected, IP: %s\n", WiFi.localIP().toString().c_str());

  // ── HTTPS client (no cert verification — anon key only, no user data) ────
  WiFiClientSecure client;
  client.setInsecure(); // acceptable: anon key + RLS INSERT-only

  // ── POST each metric ─────────────────────────────────────────────────────
  struct { const char* name; float val; bool send; } metrics[] = {
    { "temperature", temperature, true       },
    { "humidity",    humidity,    true       },
    { "pressure",    pressure,    true       },
    { "light",       light,       hasLight   },
  };

  for (auto& m : metrics) {
    if (!m.send || isnan(m.val)) continue;
    int status = postReading(client, m.name, m.val);
    Serial.printf("[POST] %s → HTTP %d\n", m.name, status);
    // Brief pause between requests to avoid hammering the API
    delay(100);
  }

  WiFi.disconnect(true);

  // ── Deep sleep until next cycle ──────────────────────────────────────────
  Serial.printf("[Sleep] %lu s\n", SLEEP_INTERVAL_US / 1000000UL);
  ESP.deepSleep(SLEEP_INTERVAL_US);
}

void loop() {
  // Never reached — deep sleep resets the chip
}
