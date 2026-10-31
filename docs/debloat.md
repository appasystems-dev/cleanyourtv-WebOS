# Debloat

An optional clean-up of LG's ads and telemetry. It is on by default in the setup and has a switch in the
[manager app](manager.md).

## What it does

About a minute after every boot, the debloat:

- **stops** the systemd services `remotelogger`, `service-logger`, `contentminer` and `nudge`;
- **prevents** `acr2`, `admanager`, `sportsalarm` and `adoverlay-service` from starting, by mounting a do-nothing stub over each
  program (in RAM; the real files are not changed);
- **adds** `eic.ads.lgtvcommon.com`, `nl.ad.lgsmartad.com` and `nl.info.lgsmartad.com` to `/etc/hosts`, pointing at `127.0.0.1`
  and `::1` and marked `# cleanyourtv-debloat` (other entries are untouched). Where `/etc/hosts` is on the read-only system partition, a copy
  with these lines is kept in RAM (`/tmp/cleanyourtv-hosts`) and mounted over it until the next restart.

Optionally, per TV, it also keeps services of features you do not use from starting, in the same way: list them, separated by spaces, in
`/media/developer/cleanyourtv/debloat-extra`. Only these can be named: `airplay` and `airplay-adaptor` (Apple AirPlay), `homekit` (Apple
HomeKit) and `iot-client` (LG ThinQ's smart-home client). Together they take about 15 MB of a 1 GB TV's memory. Screen sharing from
a Windows PC (Miracast) does not use them. Removing a name takes effect at the next restart or when Debloat is switched off.

Nothing is uninstalled. It applies only while the launcher is Home, because LG's own Home needs some of those services to start;
switching back to LG's Home lifts the debloat first.

## Turning it off

Switch **Debloat** off in the manager app. It starts the stopped services again, unmounts the stubs and removes the marked
hosts lines. To pause it without the manager, create `/media/developer/cleanyourtv/DISABLE-DEBLOAT`.

## What it does not do

It does not block updates: firmware update blocking (for example with the Homebrew Channel's tools) is separate and is not touched.
It does not claim to remove all tracking. It stops the services listed above and nothing else.
