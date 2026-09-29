import { NativeHlsStallRecovery } from './nativeHlsStallRecovery';

/** Owns the native-HLS timer and the recovery budget for a single player. */
export class NativeHlsStallWatchdog {
    #recovery = new NativeHlsStallRecovery();
    #timer;
    #paused = true;
    #isRecoverable;
    #getMediaElement;
    #onStall;

    constructor({ isRecoverable, getMediaElement, onStall }) {
        this.#isRecoverable = isRecoverable;
        this.#getMediaElement = getMediaElement;
        this.#onStall = onStall;
    }

    play(previousItemId, itemId) {
        this.stop();
        // A recreated stream needs its own 12-second progress clock even if
        // resolving it took longer than the cooldown. Keep the attempt budget
        // for continuous playback of the same item.
        this.#paused = true;
        if (!previousItemId || previousItemId !== itemId) {
            this.#recovery.reset();
        }
    }

    start(elem, event) {
        if (!this.#isRecoverable()) return;

        if (event === 'play' || event === 'playing') {
            if (this.#paused) {
                // First start or genuine resume; paused time is not stall time.
                this.#recovery.markPlaybackActive(elem.currentTime);
                this.#paused = false;
            } else {
                // Repeated play/playing after buffering cannot postpone a stall.
                this.#recovery.markPlaying(elem.currentTime);
            }
        }

        if (!this.#timer) {
            this.#timer = setInterval(() => this.check(), 2_000);
        }
    }

    observeProgress(time) {
        this.#recovery.observeProgress(time);
    }

    pause() {
        this.stop();
        this.#paused = true;
    }

    stop(reset = false) {
        if (this.#timer) {
            clearInterval(this.#timer);
            this.#timer = undefined;
        }
        if (reset) {
            this.#recovery.reset();
            this.#paused = true;
        }
    }

    check() {
        const elem = this.#getMediaElement();
        if (!elem || !this.#isRecoverable() || elem.paused || elem.ended || elem.seeking) return;

        const mediaTime = elem.currentTime;
        this.#recovery.observeProgress(mediaTime);
        if (!this.#recovery.tryRecovery()) return;

        const bufferedRanges = [];
        for (let i = 0; i < elem.buffered.length; i++) {
            bufferedRanges.push([elem.buffered.start(i), elem.buffered.end(i)]);
        }
        this.#onStall({
            positionMs: Math.round(mediaTime * 1_000),
            readyState: elem.readyState,
            networkState: elem.networkState,
            bufferedRanges
        });
    }
}
