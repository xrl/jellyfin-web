// Smoke-check the emitted application chunks; source tests enforce the behavior.
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

const dist = path.resolve(__dirname, '../dist');
const files = readdirSync(dist, { recursive: true })
    .filter(file => file.endsWith('.js') && !file.startsWith(`libraries${path.sep}`))
    .map(file => path.join(dist, file));
if (!files.length) throw new Error('No built application JavaScript found in dist/');

const bundle = files.map(file => readFileSync(file, 'utf8')).join('\n');
const markers = {
    'explicit DTS profile': ['enableDts', 'dca'],
    'HDR fallback ranges': ['DOVIWithHDR10Plus', 'DOVIWithELHDR10Plus'],
    'fMP4 preference': ['preferFmp4HlsContainer', 'video/mp4'],
    'native HLS recovery': ['nativehlsstall', 'bufferedRanges']
};
for (const [patch, tokens] of Object.entries(markers)) {
    for (const token of tokens) {
        if (!bundle.includes(token)) throw new Error(`${patch}: missing ${token} from dist/ JavaScript`);
    }
    console.log(`${patch}: ${tokens.join(', ')}`);
}
