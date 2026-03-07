import { SelectorUtil } from '@angular-spotify/web/shared/utils';
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { playlistTrackFeatureKey, PlaylistTracksState } from './playlist-tracks.reducer';

export const getPlaylistTracksState = createFeatureSelector<PlaylistTracksState>(
  playlistTrackFeatureKey
);

export const getPlaylistTracksLoading = createSelector(
  getPlaylistTracksState,
  SelectorUtil.isLoading
);

export const getPlaylistTracksById = (playlistId: string) =>
  createSelector(getPlaylistTracksState, ({ data }) => {
    const entry = data?.get(playlistId);
    return entry ? entry.items : null;
  });

export const getPlaylistTracksHasMore = (playlistId: string) =>
  createSelector(getPlaylistTracksState, ({ data }) => {
    const entry = data?.get(playlistId);
    return entry ? entry.next !== null : false;
  });
