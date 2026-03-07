import { SelectorUtil } from '@angular-spotify/web/shared/utils';
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { categoryPlaylistsFeatureKey, CategoryPlaylistsState } from './category-playlists.reducer';

export const getCategoryPlaylistsState = createFeatureSelector<CategoryPlaylistsState>(
  categoryPlaylistsFeatureKey
);

export const getCategoryPlaylistsLoading = createSelector(
  getCategoryPlaylistsState,
  SelectorUtil.isLoading
);

export const getCategoryPlaylistsMap = createSelector(getCategoryPlaylistsState, (s) => s.data);
export const getCategoryPlaylistsById = (categoryId: string) =>
  createSelector(getCategoryPlaylistsMap, (map) => {
    const entry = map?.get(categoryId);
    return entry ? SelectorUtil.getPlaylistsWithRoute(entry.items) : null;
  });

export const getCategoryPlaylistsHasMore = (categoryId: string) =>
  createSelector(getCategoryPlaylistsMap, (map) => {
    const entry = map?.get(categoryId);
    return entry ? entry.next !== null : false;
  });
