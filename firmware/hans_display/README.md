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

```bash
cp firmware/hans_display/secrets.yaml.example firmware/hans_display/secrets.yaml
```

`hans_dashboard_url` has to be reachable *from the device*, so during bring-up
point it at your Mac's LAN address, not `localhost`:

```bash
ipconfig getifaddr en0
```

Generate the API key with `python3 -c "import base64,os;print(base64.b64encode(os.urandom(32)).decode())"`.

## 4. Flash over USB

```bash
~/.esphome-venv/bin/esphome run firmware/hans_display/hans-display.yaml
```

Only the first flash needs the cable; after that ESPHome updates over the air.
If the port is not detected, hold BOOT while plugging in.

Note that GPIO19/20 carry I²C on this board and are also the USB-Serial-JTAG
pins, so USB logging stops working once the SHT4x initialises. That is why the
config includes an `api:` block — `esphome logs` reaches the device over the
network instead.

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

**Text renders in a fallback face.** resvg only loads fonts from disk. Drop
`.ttf` files into `server/assets/fonts/` and they get picked up; without them
the renderer falls back to whatever the host has installed, which is thin on a
serverless runtime.
