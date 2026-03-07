import { GenericState } from '@angular-spotify/web/shared/data-access/models';
import { createReducer, on } from '@ngrx/store';
import {
  loadPlaylistTracks,
  loadPlaylistTracksError,
  loadPlaylistTracksSuccess,
  loadMorePlaylistTracks,
  setPlaylistTracksStateStatus
} from './playlist-tracks.action';

export const playlistTrackFeatureKey = 'playlistTracks';

export interface PlaylistTracksEntry {
  items: SpotifyApi.PlaylistTrackObject[];
  next: string | null;
  total: number;
  offset: number;
  limit: number;
}

export type PlaylistTracksState = GenericState<Map<string, PlaylistTracksEntry>>;

const initialState: PlaylistTracksState = {
  data: new Map(),
  status: 'pending',
  error: null
};

export const playlistTracksReducer = createReducer(
  initialState,
  on(loadPlaylistTracks, (state) => ({ ...state, status: 'loading' as const })),
  on(loadMorePlaylistTracks, (state) => ({ ...state, status: 'loading' as const })),
  on(loadPlaylistTracksSuccess, (state, { playlistId, playlistTracks }) => {
    const map = new Map(state.data!);
    const existing = map.get(playlistId);
    map.set(playlistId, {
      items: [...(existing?.items || []), ...playlistTracks.items],
      next: playlistTracks.next,
      total: playlistTracks.total,
      offset: playlistTracks.offset,
      limit: playlistTracks.limit,
    });
    return { ...state, data: map, status: 'success' as const };
  }),
  on(loadPlaylistTracksError, (state, { error }) => ({
    ...state,
    error,
    status: 'error' as const
  })),
  on(setPlaylistTracksStateStatus, (state, { status }) => ({ ...state, status }))
);
