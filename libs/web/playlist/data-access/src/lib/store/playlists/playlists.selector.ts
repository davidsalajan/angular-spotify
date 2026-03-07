import { selectHasMore } from '@angular-spotify/web/shared/data-access/models';
import { SelectorUtil } from '@angular-spotify/web/shared/utils';
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { playlistsFeatureKey, PlaylistsState } from './playlists.reducer';

export const getPlaylistsState = createFeatureSelector<PlaylistsState>(playlistsFeatureKey);
export const getPlaylistItems = createSelector(getPlaylistsState, (state) => state.data);
export const getPlaylistsLoading = createSelector(getPlaylistsState, SelectorUtil.isLoading);
export const getPlaylistsHasMore = createSelector(getPlaylistsState, selectHasMore);
export const getPlaylistsMap = createSelector(getPlaylistsState, (state) => state.map);
export const getPlaylist = (playlistId: string) =>
  createSelector(getPlaylistsMap, (map) => map?.get(playlistId));
