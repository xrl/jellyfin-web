import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NativeHlsStallWatchdog } from './nativeHlsStallWatchdog';

const mediaElement = () => ({
    currentTime: 15,
    paused: false,
    ended: false,
    seeking: false,
    readyState: 3,
    networkState: 2,
    buffered: { length: 1, start: () => 10, end: () => 20 }
});

const createWatchdog = (elem, onStall, isRecoverable = () => true) => new NativeHlsStallWatchdog({
    isRecoverable,
    getMediaElement: () => elem,
    onStall
});

describe('native HLS player watchdog lifecycle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
    });
    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('does not defer a stall on waiting/playing cycles without media progress', () => {
        const elem = mediaElement();
        const onStall = vi.fn();
        const watchdog = createWatchdog(elem, onStall);
        watchdog.play(undefined, 'item-a');
        watchdog.start(elem, 'play');
        vi.advanceTimersByTime(5_000);
        watchdog.start(elem, 'waiting');
        watchdog.start(elem, 'playing');
        vi.advanceTimersByTime(6_000);
        watchdog.start(elem, 'playing');
        vi.advanceTimersByTime(1_000);
        expect(onStall).toHaveBeenCalledExactlyOnceWith({
            positionMs: 15_000, readyState: 3, networkState: 2, bufferedRanges: [[10, 20]]
        });
        watchdog.stop(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('retains the three-attempt budget through same-item stream recreation', () => {
        const elem = mediaElement();
        const onStall = vi.fn();
        const watchdog = createWatchdog(elem, onStall);
        watchdog.play(undefined, 'item-a');
        watchdog.start(elem, 'play');
        for (const attemptAt of [12_000, 42_000, 72_000]) {
            vi.advanceTimersToNextTimer(); // watchdog polling is running
            vi.setSystemTime(attemptAt);
            watchdog.check();
            expect(onStall).toHaveBeenCalledTimes((attemptAt - 12_000) / 30_000 + 1);
            watchdog.play('item-a', 'item-a'); // playbackmanager.changeStream replays on same player
            watchdog.start(elem, 'playing');
        }
        vi.setSystemTime(102_000);
        watchdog.check();
        expect(onStall).toHaveBeenCalledTimes(3);
        watchdog.play('item-a', 'item-b');
        watchdog.start(elem, 'play');
        vi.setSystemTime(114_000);
        watchdog.check();
        expect(onStall).toHaveBeenCalledTimes(4);
        watchdog.stop(true);
    });

    it('stops polling on pause/end/error/destroy, excludes seek and genuine resume restarts clock', () => {
        const elem = mediaElement();
        const onStall = vi.fn();
        const watchdog = createWatchdog(elem, onStall);
        watchdog.play(undefined, 'item-a');
        watchdog.start(elem, 'play');
        elem.seeking = true;
        vi.advanceTimersByTime(12_000);
        expect(onStall).not.toHaveBeenCalled();
        elem.seeking = false;
        watchdog.pause(); // pause: no timer, no recovery while paused
        expect(vi.getTimerCount()).toBe(0);
        vi.advanceTimersByTime(60_000);
        watchdog.start(elem, 'play'); // real resume
        vi.advanceTimersByTime(11_999);
        expect(onStall).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(onStall).toHaveBeenCalledTimes(1);
        watchdog.stop(true); // end/destroy cleanup
        expect(vi.getTimerCount()).toBe(0);
        vi.advanceTimersByTime(60_000);
        expect(onStall).toHaveBeenCalledTimes(1);
    });

    it('never starts a timer for a non-native/non-webOS stream', () => {
        const elem = mediaElement();
        const onStall = vi.fn();
        const watchdog = createWatchdog(elem, onStall, () => false);
        watchdog.start(elem, 'play');
        expect(vi.getTimerCount()).toBe(0);
        vi.advanceTimersByTime(60_000);
        expect(onStall).not.toHaveBeenCalled();
    });
});
