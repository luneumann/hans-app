# Hans panel — reTerminal E1002 bring-up

The device renders nothing itself. It wakes, pulls a finished 800×480 PNG from
`/api/epaper.png`, paints it, and goes back to sleep. Design changes ship by
redeploying the Nuxt app, not by reflashing.

## 1. Check the hardware first

Charge over USB-C and power it on before flashing anything. It arrives running
Seeed's SenseCraft firmware, which draws a demo screen — enough to confirm the
panel and battery are fine. Flashing is a one-way trip away from that.

## 2. Install ESPHome

```bash
python3 -m venv ~/.esphome-venv && ~/.esphome-venv/bin/pip install esphome
```

Verified against ESPHome 2026.8.0.

## 3. Fill in the secrets

`secrets.yaml` is git-ignored, so it does not exist in a fresh checkout:

```bash
cp firmware/hans_display/secrets.yaml.example firmware/hans_display/secrets.yaml
```

Everything in it can be derived except the Wi-Fi credentials. Note that
`hans_dashboard_url` has to be reachable *from the device*, so during bring-up
it points at this Mac's LAN address (`ipconfig getifaddr en0`), never
`localhost`. The token there must match `EPAPER_TOKEN` in `.env`.

Generate the API key with `python3 -c "import base64,os;print(base64.b64encode(os.urandom(32)).decode())"`.

The dev server has to be running and reachable while the panel refreshes —
`npm run dev`, with `DEV_ALLOWED_HOSTS` in `.env` naming the LAN IP.

## 4. Flash over USB

```bash
~/.esphome-venv/bin/esphome run firmware/hans_display/hans-display.yaml
```

Only the first flash needs the cable; after that ESPHome updates over the air.

The USB-C port runs through a CH340 bridge on UART0, not the ESP32-S3's native
USB, so the device appears as `/dev/cu.usbserial-*` rather than `usbmodem`, and
macOS may need WCH's CH340 driver. The bridge drives EN/BOOT, so no button
press is needed to enter flashing mode. The config pins `logger` to UART0 for
the same reason — ESPHome's default of USB_SERIAL_JTAG would log into a
peripheral nothing is attached to.

## 5. Verify

The panel refreshes on boot (after a 20 s delay for Wi-Fi and SNTP), then every
30 minutes outside 01:00–06:00. The button on GPIO5 forces a refresh. A full
colour refresh takes roughly 25 seconds — the flicker is normal.

To see what the device sees:

```bash
curl -o /tmp/panel.png "http://<your-mac>:3000/api/epaper.png?token=$EPAPER_TOKEN"
```

`/api/epaper.svg` serves the same layout undithered for iterating in a browser.
Colours there are the addressing values; the panel renders them muted.

## 6. Turn on deep sleep

Leave it off until the panel shows what you expect — while asleep the device is
unreachable for OTA. Then uncomment the `deep_sleep` block at the end of the
config. Battery life goes from roughly a fortnight to months.

## Troubleshooting

**Panel says "stale" or shows `--`.** The endpoint reads `sensor_readings` with
`SUPABASE_SERVICE_KEY`; the anon key is INSERT-only under RLS and returns an
empty set without erroring. Check the key is set, then check the table actually
has recent rows.

**Nothing appears and the log shows a fetch error.** The last frame stays on
screen by design. Check the Mac is reachable on the LAN (macOS firewall blocks
incoming connections by default) and that the token matches `EPAPER_TOKEN`.

**The endpoint answers `426 Upgrade Required` over the LAN.** The dev server is
bound to loopback only, leaving a WebSocket-only socket on the wildcard address
that rejects plain GETs. `devServer.host` in `nuxt.config.ts` handles this;
check it survived if you see a 426 where localhost returns 200.

**Text renders in a fallback face.** resvg only loads fonts from disk. Drop
`.ttf` files into `server/assets/fonts/` and they get picked up; without them
the renderer falls back to whatever the host has installed, which is thin on a
serverless runtime.
