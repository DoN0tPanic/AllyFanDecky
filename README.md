# AllyFanDecky

Author: **DoN0tPanic**

Decky plugin (**root**) for **ASUS ROG Ally**:
- switch fan curve presets (Balanced / Aggressive)
- in-game monitoring: CPU/GPU temperature + CPU/GPU fan RPM graphs

## Requirements

- Decky Loader installed
- Your fan curve systemd setup already present:
  - `ally-fan-curve.service`
  - `/usr/local/bin/ally-fan-profile`
  - `/etc/ally-fan-profile.conf`

## Install (one-liner)

```bash
curl -fsSL https://raw.githubusercontent.com/DoN0tPanic/AllyFanDecky/main/install.sh | bash
