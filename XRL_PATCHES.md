# XRL Jellyfin Web patches

This fork publishes patched production bundles for the LG webOS client used by the XRL homelab. Release tags use the form `v<upstream-version>-xrl.<revision>` and are based on the matching upstream Jellyfin Web tag.

## `v10.11.11-xrl.1`

Base: [`jellyfin/jellyfin-web@v10.11.11`](https://github.com/jellyfin/jellyfin-web/releases/tag/v10.11.11)

Carried playback changes:

1. **Conservative DTS detection** — do not trust browser `canPlayType()` results for DTS. DTS can still be enabled explicitly for clients with a working passthrough path. This prevents silent audio on LG models that advertise DTS but cannot decode it.
2. **webOS Dolby Vision/HDR fallback ranges** — advertise HDR fallback range types for all webOS clients, including Dolby Vision-capable panels, to avoid unnecessary transcoding and loss of HDR10+ metadata. Upstream 10.11.11 handles webOS panels without Dolby Vision; this patch deliberately retains the broader behavior needed by the LG C2.
3. **fMP4 HLS on webOS** — prefer fragmented MP4/CMAF HLS over MPEG-TS so Dolby Vision and HDR10+ signaling survives the container choice.

The earlier `enableMkvProgressive` experiment is not carried because the option was not consumed by the device-profile code and had no runtime effect.

## Release process

1. Rebase or port the patches onto the desired upstream release tag.
2. Run `npm ci --no-audit`, `npm run lint`, `npm test`, and `npm run build:production` with the Node version in `.nvmrc`.
3. Tag the tested commit, for example `v10.11.11-xrl.1`.
4. The `Release` workflow builds `dist/` and publishes `jellyfin-web-dist.tar.gz` plus its SHA-256 checksum.
5. Update `xrl/jellyfin-rpi` to consume the matching upstream server image, web release tag, and pinned asset checksum.
