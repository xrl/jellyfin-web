import { describe, expect, it } from 'vitest';

import { NativeHlsStallRecovery } from './nativeHlsStallRecovery';

const createRecovery = () => new NativeHlsStallRecovery({
    stallTimeoutMs: 10_000,
    recoveryCooldownMs: 30_000,
    recoveryWindowMs: 120_000,
    maxRecoveries: 3
});

describe('NativeHlsStallRecovery', () => {
    it('waits for the stall timeout before recovering', () => {
        const recovery = createRecovery();
        recovery.markPlaybackActive(15, 1_000);

        expect(recovery.tryRecovery(10_999)).toBe(false);
        expect(recovery.tryRecovery(11_000)).toBe(true);
    });

    it('postpones recovery when media time advances', () => {
        const recovery = createRecovery();
        recovery.markPlaybackActive(15, 1_000);
        recovery.observeProgress(16, 9_000);

        expect(recovery.tryRecovery(11_000)).toBe(false);
        expect(recovery.tryRecovery(19_000)).toBe(true);
    });

    it('ignores repeated observations at the same media time', () => {
        const recovery = createRecovery();
        recovery.markPlaybackActive(15, 1_000);
        recovery.observeProgress(15, 9_000);

        expect(recovery.tryRecovery(11_000)).toBe(true);
    });

    it('enforces a cooldown between recoveries', () => {
        const recovery = createRecovery();
        recovery.markPlaybackActive(15, 0);

        expect(recovery.tryRecovery(10_000)).toBe(true);
        expect(recovery.tryRecovery(20_000)).toBe(false);
        expect(recovery.tryRecovery(40_000)).toBe(true);
    });

    it('bounds recoveries inside the rolling window', () => {
        const recovery = createRecovery();
        recovery.markPlaybackActive(15, 0);

        expect(recovery.tryRecovery(10_000)).toBe(true);
        expect(recovery.tryRecovery(40_000)).toBe(true);
        expect(recovery.tryRecovery(70_000)).toBe(true);
        expect(recovery.tryRecovery(100_000)).toBe(false);
        expect(recovery.tryRecovery(131_000)).toBe(true);
    });

    it('can observe progress after playback starts with an invalid media time', () => {
        const recovery = createRecovery();
        recovery.markPlaybackActive(Number.NaN, 0);
        recovery.observeProgress(15, 9_000);

        expect(recovery.tryRecovery(10_000)).toBe(false);
        expect(recovery.tryRecovery(19_000)).toBe(true);
    });

    it('uses the production 12-second stall, 30-second cooldown and 3-in-10-minute budget', () => {
        const recovery = new NativeHlsStallRecovery();
        recovery.markPlaybackActive(15, 0);

        expect(recovery.tryRecovery(11_999)).toBe(false);
        expect(recovery.tryRecovery(12_000)).toBe(true);
        expect(recovery.tryRecovery(41_999)).toBe(false);
        expect(recovery.tryRecovery(42_000)).toBe(true);
        expect(recovery.tryRecovery(72_000)).toBe(true);
        expect(recovery.tryRecovery(102_000)).toBe(false);
        expect(recovery.tryRecovery(612_001)).toBe(true);
    });

    it('does not postpone recovery across repeated waiting/playing with unchanged time', () => {
        const recovery = new NativeHlsStallRecovery();
        recovery.markPlaybackActive(15, 0); // play event
        recovery.markPlaying(15, 5_000); // playing after waiting, no advancement
        recovery.markPlaying(15, 11_000);
        expect(recovery.tryRecovery(12_000)).toBe(true);
    });

    it('retains the same-item budget when playback restarts at the recovered position', () => {
        const recovery = new NativeHlsStallRecovery();
        recovery.markPlaybackActive(15, 0);
        expect(recovery.tryRecovery(12_000)).toBe(true);
        recovery.markPlaybackActive(15, 15_000);
        expect(recovery.tryRecovery(27_000)).toBe(false);
        expect(recovery.tryRecovery(42_000)).toBe(true);
        recovery.markPlaybackActive(15, 44_000);
        expect(recovery.tryRecovery(72_000)).toBe(true);
        recovery.markPlaybackActive(15, 75_000);
        expect(recovery.tryRecovery(100_000)).toBe(false);
    });

    it('clears progress and rate limits when reset', () => {
        const recovery = createRecovery();
        recovery.markPlaybackActive(15, 0);
        expect(recovery.tryRecovery(10_000)).toBe(true);

        recovery.reset();
        expect(recovery.tryRecovery(100_000)).toBe(false);

        recovery.markPlaybackActive(20, 100_000);
        expect(recovery.tryRecovery(110_000)).toBe(true);
    });
});
