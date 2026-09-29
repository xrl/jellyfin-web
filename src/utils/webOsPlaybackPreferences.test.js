import { describe, expect, it } from 'vitest';

import { allowHdrFallbackRanges, defaultPreferFmp4HlsContainer, supportsDts } from './webOsPlaybackPreferences';

describe('webOS playback profile policy', () => {
    it('does not trust a false-positive DTS browser probe, but honors explicit opt-in', () => {
        expect(supportsDts(false, undefined)).toBe(false);
        expect(supportsDts(false, false)).toBe(false);
        expect(supportsDts(true, false)).toBe(true);
        expect(supportsDts(false, true)).toBe(true);
    });

    it('advertises HDR fallback for both DV-capable and non-DV webOS devices only with HDR capability', () => {
        // The device profile calls this only inside supportsHdr10(options).
        expect(allowHdrFallbackRanges({ web0s: true, supportsDolbyVision: true })).toBe(true);
        expect(allowHdrFallbackRanges({ web0s: true, supportsDolbyVision: false })).toBe(true);
        expect(allowHdrFallbackRanges({ web0s: false, tizenVersion: 2 })).toBe(false);
        expect(allowHdrFallbackRanges({ tizenVersion: 3 })).toBe(true);
    });

    it('defaults webOS to fMP4 without overriding a saved false or native capability guards', () => {
        expect(defaultPreferFmp4HlsContainer({ web0s: true })).toBe(true);
        expect(defaultPreferFmp4HlsContainer({})).toBe(false);
        // UserSettings applies toBoolean(savedValue, default) and the device profile
        // separately requires native fMP4 support before selecting an MP4 profile.
    });
});
