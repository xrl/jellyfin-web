// Keep the client capability overrides separate from the native capability guards
// in browserDeviceProfile; a preference alone must never force unsupported fMP4.
export function defaultPreferFmp4HlsContainer(browser) {
    return !!(browser.safari || browser.firefox || browser.chrome || browser.edgeChromium || browser.web0s);
}

export function allowHdrFallbackRanges(browser) {
    return browser.tizenVersion >= 3 || browser.vidaa || browser.web0s;
}

// canPlayType reports false-positive DTS support on some webOS devices.
// Explicit DTS preferences and caller options are handled by the device profile.
export function autoDetectDts() {
    return false;
}

export function supportsDts(explicitPreference, callerOption) {
    return !!(explicitPreference || callerOption || autoDetectDts());
}
