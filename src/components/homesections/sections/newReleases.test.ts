import type { ApiClient } from 'jellyfin-apiclient';
import { afterEach, expect, test, vi } from 'vitest';

import { loadNewReleases } from './newReleases';
import type { SectionContainerElement } from './section';

const { getItems } = vi.hoisted(() => ({ getItems: vi.fn() }));
vi.mock('@jellyfin/sdk/lib/utils/api/library-api', () => ({
    getLibraryApi: () => ({ getItems })
}));
vi.mock('components/cardbuilder/cardBuilder', () => ({ default: {} }));
vi.mock('components/cardbuilder/utils/shape', () => ({ getPortraitShape: () => 'portrait' }));
vi.mock('lib/globalize', () => ({ default: { translate: () => 'New Releases' } }));
vi.mock('lib/jellyfin-apiclient/ServerConnections', () => ({ default: { getApi: () => ({}) } }));

afterEach(() => {
    vi.useRealTimers();
});

test('requests unwatched movies for the signed-in viewer and recalculates the release window when refreshed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-28T14:00:00Z'));
    const userId = 'viewer';
    const apiClient = {
        getCurrentUserId: () => userId,
        serverId: () => 'server'
    } as ApiClient;
    const section = document.createElement('div');
    getItems.mockResolvedValue({ data: { Items: [] } });

    loadNewReleases(section, apiClient, { enableOverflow: true });

    const items = section.querySelector<SectionContainerElement>('.itemsContainer')!;
    expect(section.classList.contains('hide')).toBe(true);
    expect(items.parentContainer).toBe(section);
    expect(items.getAttribute('data-monitor')).toBe('videoplayback,markplayed');
    await expect(items.fetchData()).resolves.toEqual({ Items: [] });
    expect(getItems).toHaveBeenLastCalledWith(expect.objectContaining({
        userId,
        includeItemTypes: [ 'Movie' ],
        isPlayed: false,
        collapseBoxSetItems: false,
        minPremiereDate: '2026-09-29',
        maxPremiereDate: '2026-11-28T14:00:00.000Z',
        sortBy: [ 'PremiereDate', 'SortName' ],
        sortOrder: [ 'Descending', 'Ascending' ]
    }));

    vi.setSystemTime(new Date('2026-11-29T14:00:00Z'));
    await items.fetchData();
    expect(getItems).toHaveBeenLastCalledWith(expect.objectContaining({
        minPremiereDate: '2026-09-30',
        maxPremiereDate: '2026-11-29T14:00:00.000Z'
    }));
});
