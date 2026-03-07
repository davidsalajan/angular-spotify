import { GenericState, SpotifyApiPlayHistoryObject } from '@angular-spotify/web/shared/data-access/models';
import { createReducer, on } from '@ngrx/store';
import { loadRecentTracks, loadMoreRecentTracks, loadRecentTracksError, loadRecentTracksSuccess } from './recent-played-tracks.action';

export interface RecentPlayedTracksState extends GenericState<SpotifyApiPlayHistoryObject[]> {
  afterCursor: number | null;
  next: string | null;
}

const initialState: RecentPlayedTracksState = {
  data: null,
  status: 'pending',
  error: null,
  afterCursor: null,
  next: null,
};

export const recentFeatureTracksFeatureKey = 'recentTracks';

export const recentPlayedTracksReducer = createReducer(
  initialState,
  on(loadRecentTracks, (state) => ({ ...state, status: 'loading' as const })),
  on(loadMoreRecentTracks, (state) => ({ ...state, status: 'loading' as const })),
  on(loadRecentTracksSuccess, (state, { response }) => ({
    ...state,
    data: [...(state.data || []), ...response.items],
    afterCursor: response.cursors?.after ? Number(response.cursors.after) : null,
    next: response.next || null,
    status: 'success' as const,
    error: null,
  })),
  on(loadRecentTracksError, (state, { error }) => ({
    ...state,
    error,
    status: 'error' as const,
  }))
);
