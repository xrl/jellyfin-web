const optionPrefix = 'xrl-stereo:';
const label = 'Compatibility: AAC Stereo';

export function isCompatibilityAudioClient(browser, appName, nativeShell) {
    return browser.iphone === true && !browser.ipad && appName === 'Jellyfin iOS' && !!nativeShell;
}

function compatibilityAudioOptions(mediaSource, tracks) {
    if (!mediaSource?.Id || mediaSource.Protocol !== 'File' || mediaSource.IsRemote || mediaSource.RequiresOpening
        || !mediaSource.MediaStreams.some(stream => stream.Type === 'Video' && ['h264', 'hevc'].includes(stream.Codec))) {
        return [];
    }

    return tracks.filter(track => Number.isInteger(track.Index) && track.Channels >= 2 && !track.IsExternal)
        .map(track => ({
            value: optionPrefix + track.Index,
            label: tracks.length === 1 ? label : label + ' — ' + track.DisplayTitle,
            copyAudio: track.Codec === 'aac' && track.Channels === 2 && track.Profile === 'LC'
        }));
}

export function addCompatibilityAudioOptions(select, mediaSource, tracks) {
    for (const { value, label: title, copyAudio } of compatibilityAudioOptions(mediaSource, tracks)) {
        const option = new Option(title, value);
        option.dataset.compatibilityAudio = mediaSource.Id;
        option.dataset.copyAudio = String(copyAudio);
        select.add(option);
    }
}

export function readCompatibilityAudioSelection(select, mediaSourceId) {
    const option = select.options[select.selectedIndex];
    if (option?.dataset.compatibilityAudio !== mediaSourceId || !option?.value.startsWith(optionPrefix)) {
        return null;
    }

    const audioStreamIndex = Number(option.value.slice(optionPrefix.length));
    if (!Number.isSafeInteger(audioStreamIndex) || audioStreamIndex < 0) {
        return null;
    }

    return {
        mediaSourceId,
        audioStreamIndex,
        copyAudio: option.dataset.copyAudio === 'true'
    };
}

function compatibilityPlaybackQuery(query, selection, deviceProfile) {
    const videoProfile = deviceProfile.TranscodingProfiles?.find(profile =>
        profile.Type === 'Video' && profile.Context === 'Streaming'
        && profile.Protocol === 'hls' && profile.Container === 'mp4'
        && profile.AudioCodec?.split(',').includes('aac')
    );
    if (!videoProfile) {
        return null;
    }

    return {
        ...query,
        MediaSourceId: selection.mediaSourceId,
        AudioStreamIndex: selection.audioStreamIndex,
        EnableDirectPlay: false,
        // In 12.3 this preserves remux eligibility when video encoding is disabled.
        // The empty direct-play profile and response checks keep this on HLS.
        EnableDirectStream: true,
        EnableTranscoding: true,
        AllowVideoStreamCopy: true,
        AllowAudioStreamCopy: selection.copyAudio,
        MaxAudioChannels: 2,
        AlwaysBurnInSubtitleWhenTranscoding: false,
        DeviceProfile: {
            ...deviceProfile,
            DirectPlayProfiles: [],
            TranscodingProfiles: [{ ...videoProfile, AudioCodec: 'aac', MaxAudioChannels: '2' }]
        }
    };
}

function validateCompatibilitySource(source, selection, baseUrl) {
    if (source?.Id !== selection.mediaSourceId || source.DefaultAudioStreamIndex !== selection.audioStreamIndex
        || !source.SupportsTranscoding || !source.TranscodingUrl || source.TranscodingSubProtocol !== 'hls'
        || source.TranscodingContainer !== 'mp4' || source.SupportsDirectPlay || source.SupportsDirectStream) {
        return false;
    }

    const url = new URL(source.TranscodingUrl, baseUrl);
    const params = new URLSearchParams([...url.searchParams].map(([key, value]) => [key.toLowerCase(), value]));
    return url.pathname.endsWith('.m3u8') && params.get('audiocodec') === 'aac'
        && params.get('segmentcontainer') === 'mp4'
        && params.get('audiostreamindex') === String(selection.audioStreamIndex)
        && params.get('transcodingmaxaudiochannels') === '2'
        && (selection.copyAudio || params.get('allowaudiostreamcopy') === 'false');
}

export async function getCompatibilityPlaybackInfo(query, selection, deviceProfile, getInfo, baseUrl) {
    const compatibilityQuery = compatibilityPlaybackQuery(query, selection, deviceProfile);
    if (!compatibilityQuery) {
        return null;
    }

    const info = await getInfo(compatibilityQuery);
    const source = info.MediaSources?.find(candidate => candidate.Id === selection.mediaSourceId);
    return validateCompatibilitySource(source, selection, baseUrl) ?
        { ...info, MediaSources: [source] } :
        null;
}
