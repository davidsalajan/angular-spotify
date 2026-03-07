import { createFeatureSelector, createSelector } from '@ngrx/store';
import {
  recentFeatureTracksFeatureKey,
  RecentPlayedTracksState
} from './recent-played-tracks.reducer';
import { SelectorUtil } from '@angular-spotify/web/shared/utils';

export const getRecentPlayedTracksState = createFeatureSelector<RecentPlayedTracksState>(
  recentFeatureTracksFeatureKey
);

export const getRecentPlayedTracksLoading = createSelector(
  getRecentPlayedTracksState,
  SelectorUtil.isLoading
);

export const getRecentPlayedTracksHasMore = createSelector(
  getRecentPlayedTracksState,
  (state) => state.next !== null
);

export const getRecentPlayedTracks = createSelector(getRecentPlayedTracksState, ({ data }) => {
  if (!data) {
    return null;
  }
  return data.filter(({ track }, idx, arr) => arr.findIndex((item) => item.track.id === track.id) === idx);
});
