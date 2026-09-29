import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Guard the two production integration seams without importing the full player
// application (which requires server connections, video DOM, and browser globals).
const player = readFileSync('src/plugins/htmlVideoPlayer/plugin.js', 'utf8');
const manager = readFileSync('src/components/playback/playbackmanager.js', 'utf8');

describe('native HLS recovery wiring', () => {
    it('routes media events to the watchdog and cleans up every terminal path', () => {
        expect(player).toMatch(/onPlaying = \(e\) =>[\s\S]*?\.start\(elem, 'playing'\)/);
        expect(player).toMatch(/onPlay = \(e\) =>[\s\S]*?\.start\(e\.target, 'play'\)/);
        expect(player).toMatch(/onWaiting = \(e\) =>[\s\S]*?\.start\(e\.target, 'waiting'\)/);
        expect(player).toMatch(/onStalled = \(e\) =>[\s\S]*?\.start\(e\.target, 'waiting'\)/);
        expect(player).toMatch(/onPause = \(\) => \{[\s\S]*?\.pause\(\)/);
        expect(player).toMatch(/onError = \(e\) => \{[\s\S]*?\.stop\(\)/);
        for (const terminal of ['stop(destroyPlayer)', 'destroy()', 'onEnded = (e) =>']) {
            expect(player).toContain(terminal);
        }
        expect((player.match(/#nativeHlsStallWatchdog\.stop\(true\)/g) || []).length).toBe(3);
        expect(player).toContain("videoElement.removeEventListener('stalled', this.onStalled)");
    });

    it('forwards the emitted event to same-player stream recreation', () => {
        expect(player).toContain("Events.trigger(this, 'nativehlsstall', [details])");
        expect(manager).toContain("Events.on(player, 'nativehlsstall', onNativeHlsStall)");
        expect(manager).toMatch(/function onNativeHlsStall\(e, details\)[\s\S]*?changeStream\(player, startTime, \{\}\)/);
        expect(manager).toMatch(/function changeStreamToUrl\([\s\S]*?setSrcIntoPlayer\(apiClient, player, streamInfo\)/);
    });
});
