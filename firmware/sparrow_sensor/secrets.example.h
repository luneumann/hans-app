#pragma once

// Copy this file to `secrets.h` in the same folder and fill in the values.
// secrets.h is git-ignored and never leaves this machine.

// Wi-Fi the sensor joins on wake.
#define WIFI_SSID         "YOUR_WIFI_SSID"
#define WIFI_PASSWORD     "YOUR_WIFI_PASSWORD"

// Identifies this device. Must match a row in the Supabase `devices` table.
#define SPARROW_ID        "YOUR_SPARROW_DEVICE_ID"

// Supabase → Project Settings → API. The anon key is INSERT-only under RLS,
// which is all this device needs — it never reads.
#define SUPABASE_URL      "https://YOUR_PROJECT.supabase.co"
#define SUPABASE_ANON_KEY "YOUR_SUPABASE_ANON_KEY"
