# XRL Jellyfin Web 12.1 candidate

Base: official `jellyfin/jellyfin-web` tag `v12.1` (`fae41f33eb7cd636a9ef68984adb82bb247a6e1b`). Web package version: `12.1.0`; the official server/image tag is **`12.1`**, not `12.1.0`.

This source port preserves the four deployed behaviors from `557d9296cfafdd56263cd70283e4db7554bc526a`:

1. Conservative DTS detection; only explicit app or caller opt-in advertises DTS.
2. HDR fallback video ranges on HDR10-capable webOS, including DV-capable displays, while retaining upstream profiles.
3. webOS fMP4/CMAF HLS default, without overriding saved preferences or native capability guards.
4. Native webOS HLS no-progress watchdog: 12-second timeout, 30-second cooldown, at most three attempts per rolling ten minutes, stream recreation near current time; player stop/end/error/destroy cleanup and same-item retry-budget retention.

The ineffective `enableMkvProgressive` experiment is not carried. The new upstream webOS-25 MKV rule remains intact. These are source behaviors, **not** evidence of successful LG playback or production migration.

## Release ritual (future, requires separate authorization)

On the exact tested release commit, use the `.nvmrc` Node 24/npm 11 toolchain and upstream lockfile; run `npm ci --no-audit`, lint, tests, and `npm run build:production` (plus TypeScript/compatibility checks as applicable). The tag-triggered release workflow validates `v12.1-xrl.N`, tests, builds `dist/` with unique `JELLYFIN_VERSION`, archives the *contents* at the tar root and publishes asset plus SHA-256. Publishing a tag triggers release: **do not tag or push until reviewed and approved**. Only after inspecting the released asset and checksum should the separately reviewed image recipe consume it with the official server `12.1` base, pin/verify actual ARM64 digest and inspect runtime/FFmpeg/assets. Never infer runtime patch level from project target framework.
