import { describe, expect, it, vi } from 'vitest';
import {
    addCompatibilityAudioOptions,
    getCompatibilityPlaybackInfo,
    isCompatibilityAudioClient,
    readCompatibilityAudioSelection
} from './compatibilityAudio';

const profile = {
    TranscodingProfiles: [
        { Type: 'Video', Context: 'Streaming', Container: 'mp4', Protocol: 'http', AudioCodec: 'eac3,aac' },
        { Type: 'Video', Context: 'Streaming', Container: 'mp4', Protocol: 'hls', AudioCodec: 'aac,mp3', MaxAudioChannels: '6', VideoCodec: 'h264' }
    ]
};

const eac3 = { Index: 1, Type: 'Audio', Codec: 'eac3', Channels: 6, DisplayTitle: 'English' };
const commentary = { Index: 2, Type: 'Audio', Codec: 'aac', Profile: 'HE-AAC', Channels: 2, DisplayTitle: 'Commentary' };
const video = { Index: 0, Type: 'Video', Codec: 'h264' };

function createAudioMenu(tracks) {
    const select = document.createElement('select');
    for (const track of tracks) {
        select.add(new Option(track.DisplayTitle, String(track.Index)));
    }
    addCompatibilityAudioOptions(select, { Id: 'version-a', Protocol: 'File', MediaStreams: [video, ...tracks] }, tracks);
    return select;
}

function playbackSource(overrides = {}) {
    // This is the shape returned by the stock server's dynamic HLS negotiation.
    return {
        Id: 'version-a',
        DefaultAudioStreamIndex: 2,
        SupportsTranscoding: true,
        SupportsDirectStream: false,
        SupportsDirectPlay: false,
        TranscodingContainer: 'mp4',
        TranscodingSubProtocol: 'hls',
        TranscodingUrl: '/Videos/item/master.m3u8?AudioCodec=aac&TranscodingMaxAudioChannels=2&AllowAudioStreamCopy=false',
        ...overrides
    };
}

describe('iPhone compatibility audio', () => {
    it.each([
        [{ iphone: true }, 'Jellyfin iOS', {}, true],
        [{ iphone: true }, 'Jellyfin Web', undefined, false],
        [{ iphone: true }, 'Jellyfin iOS', undefined, false],
        [{ ipad: true }, 'Jellyfin iOS', {}, false]
    ])('requires the official iPhone shell', (browser, appName, shell, expected) => {
        expect(isCompatibilityAudioClient(browser, appName, shell)).toBe(expected);
    });

    it('offers a compatibility choice even on a one-track title and leaves the original selected', () => {
        const select = createAudioMenu([eac3]);
        expect([...select.options].map(option => option.text)).toEqual(['English', 'Compatibility: AAC Stereo']);
        expect(readCompatibilityAudioSelection(select, 'version-a')).toBeNull();
        select.selectedIndex = 1;
        expect(readCompatibilityAudioSelection(select, 'version-a')).toEqual({
            mediaSourceId: 'version-a', audioStreamIndex: 1, copyAudio: false
        });
    });

    it('uses the chosen real track, clears on original selection, and rejects a stale version', () => {
        const select = createAudioMenu([eac3, commentary]);
        select.selectedIndex = 3;
        expect(select.options[select.selectedIndex].text).toBe('Compatibility: AAC Stereo — Commentary');
        expect(readCompatibilityAudioSelection(select, 'version-a')).toEqual({
            mediaSourceId: 'version-a', audioStreamIndex: 2, copyAudio: false
        });
        expect(readCompatibilityAudioSelection(select, 'version-b')).toBeNull();
        select.value = '2';
        expect(readCompatibilityAudioSelection(select, 'version-a')).toBeNull();
    });

    it('permits passthrough only for known AAC-LC stereo', () => {
        const select = createAudioMenu([{ ...commentary, Profile: 'LC' }]);
        select.selectedIndex = 1;
        expect(readCompatibilityAudioSelection(select, 'version-a').copyAudio).toBe(true);
    });

    it('posts the chosen track and resume position using an isolated HLS profile', async () => {
        const select = createAudioMenu([eac3, commentary]);
        select.selectedIndex = 3;
        const selection = readCompatibilityAudioSelection(select, 'version-a');
        const source = playbackSource();
        const getInfo = vi.fn().mockResolvedValue({ MediaSources: [playbackSource({ Id: 'version-b' }), source] });
        const result = await getCompatibilityPlaybackInfo(
            { StartTimeTicks: 12345 }, selection, profile, getInfo, 'https://server.example/jellyfin/'
        );
        expect(result.MediaSources).toEqual([source]);
        expect(getInfo).toHaveBeenCalledExactlyOnceWith({
            StartTimeTicks: 12345,
            AudioStreamIndex: 2,
            MediaSourceId: 'version-a',
            MaxAudioChannels: 2,
            EnableDirectPlay: false,
            EnableDirectStream: false,
            EnableTranscoding: true,
            AllowVideoStreamCopy: true,
            AllowAudioStreamCopy: false,
            AlwaysBurnInSubtitleWhenTranscoding: false,
            DeviceProfile: {
                TranscodingProfiles: [{ ...profile.TranscodingProfiles[1], AudioCodec: 'aac', MaxAudioChannels: '2' }]
            }
        });
        expect(profile.TranscodingProfiles[1]).toMatchObject({ AudioCodec: 'aac,mp3', MaxAudioChannels: '6' });
    });

    it.each([
        { DefaultAudioStreamIndex: 1 },
        { TranscodingSubProtocol: 'http' },
        { SupportsDirectPlay: true },
        { TranscodingUrl: '/Videos/item/master.m3u8?AudioCodec=aac&TranscodingMaxAudioChannels=2' }
    ])('rejects incompatible server responses instead of letting native playback fall back', async overrides => {
        const getInfo = vi.fn().mockResolvedValue({ MediaSources: [playbackSource(overrides)] });
        const selection = { mediaSourceId: 'version-a', audioStreamIndex: 2, copyAudio: false };
        await expect(getCompatibilityPlaybackInfo({}, selection, profile, getInfo, 'https://server.example/')).resolves.toBeNull();
    });
});
