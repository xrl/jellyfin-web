import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
const patches = readFileSync('XRL_PATCHES.md', 'utf8');

describe('12.3 web release policy', () => {
    it('limits release tags to this upstream version and matches the web package', () => {
        expect(workflow).toContain('^v12\\.3-xrl\\.[0-9]+$');
        expect(workflow).toContain("= '12.3.0'");
        expect(workflow).toContain('based on official v12.3; see XRL_PATCHES.md.');
        expect(patches).toContain('tag `v12.3`');
        expect(patches).toContain('validates `v12.3-xrl.N`');
        expect(readFileSync('.nvmrc', 'utf8').trim()).toBe('24.22.1');
        expect(workflow).toContain('check-latest: false');
        for (const file of ['nativeHlsStallWatchdog.js', 'nativeHlsStallWatchdog.test.js', 'nativeHlsStallWiring.test.js', 'releasePolicy.test.js']) {
            expect(workflow).toContain(`src/utils/${file}`);
        }
    });
});
