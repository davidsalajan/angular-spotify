import { selectHasMore } from '@angular-spotify/web/shared/data-access/models';
import { RouteUtil, SelectorUtil } from '@angular-spotify/web/shared/utils';
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { featuredPlaylistsFeatureKey, FeaturePlaylistsState } from './feature-playlists.reducer';

export const getFeaturePlaylistsState = createFeatureSelector<FeaturePlaylistsState>(
  featuredPlaylistsFeatureKey
);

export const getFeaturedPlaylistItems = createSelector(
  getFeaturePlaylistsState,
  (state) => state.data
);

export const getFeaturedPlaylistsMessage = createSelector(
  getFeaturePlaylistsState,
  (state) => state.message
);

export const getFeaturedPlaylistsHasMore = createSelector(
  getFeaturePlaylistsState,
  selectHasMore
);

export const getFeaturedPlaylistsLoading = createSelector(
  getFeaturePlaylistsState,
  SelectorUtil.isLoading
);

export const getFeaturedPlaylistsWithRouteUrl = createSelector(
  getFeaturedPlaylistItems,
  (items) => {
    if (!items) return null;
    return items.map((item) => ({
      ...item,
      routeUrl: RouteUtil.getPlaylistRouteUrl(item.id),
    }));
  }
);
