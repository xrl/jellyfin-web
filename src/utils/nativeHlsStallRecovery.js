const DEFAULT_STALL_TIMEOUT_MS = 12_000;
const DEFAULT_RECOVERY_COOLDOWN_MS = 30_000;
const DEFAULT_RECOVERY_WINDOW_MS = 10 * 60_000;
const DEFAULT_MAX_RECOVERIES = 3;
const MEDIA_TIME_PROGRESS_EPSILON_SECONDS = 0.05;

/**
 * Tracks native HLS playback progress and rate-limits stream recreation.
 * Timer ownership and media-element checks stay in HtmlVideoPlayer so this
 * state machine remains independent of the DOM and can be tested directly.
 */
export class NativeHlsStallRecovery {
    #stallTimeoutMs;
    #recoveryCooldownMs;
    #recoveryWindowMs;
    #maxRecoveries;
    #lastProgressAt;
    #lastMediaTime;
    #recoveryTimes = [];

    constructor({
        stallTimeoutMs = DEFAULT_STALL_TIMEOUT_MS,
        recoveryCooldownMs = DEFAULT_RECOVERY_COOLDOWN_MS,
        recoveryWindowMs = DEFAULT_RECOVERY_WINDOW_MS,
        maxRecoveries = DEFAULT_MAX_RECOVERIES
    } = {}) {
        this.#stallTimeoutMs = stallTimeoutMs;
        this.#recoveryCooldownMs = recoveryCooldownMs;
        this.#recoveryWindowMs = recoveryWindowMs;
        this.#maxRecoveries = maxRecoveries;
    }

    reset() {
        this.#lastProgressAt = undefined;
        this.#lastMediaTime = undefined;
        this.#recoveryTimes = [];
    }

    markPlaybackActive(mediaTime, now = Date.now()) {
        this.#lastMediaTime = Number.isFinite(mediaTime) ? mediaTime : undefined;
        this.#lastProgressAt = now;
    }

    observeProgress(mediaTime, now = Date.now()) {
        if (!Number.isFinite(mediaTime)) return;

        if (this.#lastMediaTime === undefined
            || Math.abs(mediaTime - this.#lastMediaTime) >= MEDIA_TIME_PROGRESS_EPSILON_SECONDS
        ) {
            this.markPlaybackActive(mediaTime, now);
        }
    }

    tryRecovery(now = Date.now()) {
        if (this.#lastProgressAt === undefined
            || now - this.#lastProgressAt < this.#stallTimeoutMs
        ) {
            return false;
        }

        const windowStart = now - this.#recoveryWindowMs;
        this.#recoveryTimes = this.#recoveryTimes.filter(time => time >= windowStart);

        const lastRecoveryAt = this.#recoveryTimes[this.#recoveryTimes.length - 1];
        if (lastRecoveryAt !== undefined
            && now - lastRecoveryAt < this.#recoveryCooldownMs
        ) {
            return false;
        }

        if (this.#recoveryTimes.length >= this.#maxRecoveries) {
            return false;
        }

        this.#recoveryTimes.push(now);
        this.#lastProgressAt = now;
        return true;
    }
}
