import {
  PaginatedState,
  createInitialPaginatedState,
  onLoadPage,
  onLoadPageSuccess,
  onLoadPageError,
} from '@angular-spotify/web/shared/data-access/models';
import { SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
import { createReducer, on } from '@ngrx/store';
import {
  loadPlaylists,
  loadMorePlaylists,
  loadPlaylistsError,
  loadPlaylistsSuccess,
  loadPlaylistSuccess,
} from './playlists.action';

export const playlistsFeatureKey = 'playlists';

export interface PlaylistsState extends PaginatedState<SpotifyApi.PlaylistObjectSimplified> {
  map: Map<string, SpotifyApi.PlaylistObjectSimplified> | null;
}

const initialState: PlaylistsState = {
  ...createInitialPaginatedState<SpotifyApi.PlaylistObjectSimplified>(SPOTIFY_DEFAULT_LIMIT),
  map: null,
};

export const playlistsReducer = createReducer(
  initialState,
  on(loadPlaylists, (state) => ({ ...state, ...onLoadPage(state) })),
  on(loadMorePlaylists, (state) => ({ ...state, ...onLoadPage(state) })),
  on(loadPlaylistsSuccess, (state, { playlists }) => {
    const newState = onLoadPageSuccess(state, playlists);
    const map = new Map<string, SpotifyApi.PlaylistObjectSimplified>(state.map || undefined);
    playlists.items.forEach((playlist) => map.set(playlist.id, playlist));
    return { ...newState, map };
  }),
  on(loadPlaylistsError, (state, { error }) => ({ ...state, ...onLoadPageError(state, error) })),
  on(loadPlaylistSuccess, (state, { playlist }) => {
    const map = new Map<string, SpotifyApi.PlaylistObjectSimplified>(state.map || undefined);
    map.set(playlist.id, playlist);
    return { ...state, map };
  })
);
