import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import type { ApiClient } from 'jellyfin-apiclient';

import cardBuilder from 'components/cardbuilder/cardBuilder';
import { getPortraitShape } from 'components/cardbuilder/utils/shape';
import globalize from 'lib/globalize';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';
import { toIsoDateOnlyString } from 'utils/date';

import type { SectionContainerElement, SectionOptions } from './section';

const RELEASE_WINDOW_DAYS = 60;

export function loadNewReleases(
    elem: HTMLElement,
    apiClient: ApiClient,
    { enableOverflow }: SectionOptions
) {
    const itemsClasses = enableOverflow ?
        'scrollSlider focuscontainer-x' :
        'padded-left padded-right vertical-wrap focuscontainer-x';
    const itemsHtml = `<div is="emby-itemscontainer" class="itemsContainer ${itemsClasses}" data-monitor="videoplayback,markplayed"></div>`;
    const sectionContent = enableOverflow ?
        `<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">${itemsHtml}</div>` :
        itemsHtml;

    elem.classList.add('hide');
    elem.innerHTML = `
        <h2 class="sectionTitle sectionTitle-cards padded-left">${globalize.translate('HeaderNewReleases')}</h2>
        ${sectionContent}
    `;

    const itemsContainer = elem.querySelector<SectionContainerElement>('.itemsContainer');
    const userId = apiClient.getCurrentUserId();
    const api = ServerConnections.getApi(apiClient.serverId());
    if (!itemsContainer || !userId || !api) return;

    const libraryApi = getLibraryApi(api);
    itemsContainer.fetchData = async () => {
        const now = new Date();
        const cutoff = new Date(now);
        cutoff.setUTCDate(cutoff.getUTCDate() - RELEASE_WINDOW_DAYS);

        const { data } = await libraryApi.getItems({
            userId,
            includeItemTypes: [ BaseItemKind.Movie ],
            recursive: true,
            isPlayed: false,
            collapseBoxSetItems: false,
            minPremiereDate: toIsoDateOnlyString(cutoff),
            maxPremiereDate: now.toISOString(),
            sortBy: [ ItemSortBy.PremiereDate, ItemSortBy.SortName ],
            sortOrder: [ SortOrder.Descending, SortOrder.Ascending ],
            limit: 16,
            enableTotalRecordCount: false,
            fields: [ ItemFields.PrimaryImageAspectRatio ],
            enableImageTypes: [ ImageType.Primary ],
            imageTypeLimit: 1
        });
        return data;
    };
    itemsContainer.getItemsHtml = items => cardBuilder.getCardsHtml({
        items,
        shape: getPortraitShape(enableOverflow),
        context: 'home',
        showTitle: true,
        showYear: true,
        overlayPlayButton: true,
        lazy: true
    });
    itemsContainer.parentContainer = elem;
}
