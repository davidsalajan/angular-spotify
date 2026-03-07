import { selectHasMore } from '@angular-spotify/web/shared/data-access/models';
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { albumsFeatureKey, AlbumsState } from './albums.reducer';
import { SelectorUtil } from '@angular-spotify/web/shared/utils';

export const getAlbumsState = createFeatureSelector<AlbumsState>(albumsFeatureKey);

export const getAlbums = createSelector(getAlbumsState, (s) => s.data);
export const getAlbumsLoading = createSelector(getAlbumsState, SelectorUtil.isLoading);
export const getAlbumsHasMore = createSelector(getAlbumsState, selectHasMore);
