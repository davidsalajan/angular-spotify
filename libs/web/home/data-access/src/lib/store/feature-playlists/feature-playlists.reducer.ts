import {
  createInitialPaginatedState,
  onLoadPage,
  onLoadPageError,
  onLoadPageSuccess,
  PaginatedState,
} from '@angular-spotify/web/shared/data-access/models';
import { SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
import { createReducer, on } from '@ngrx/store';
import {
  loadFeaturedPlaylists,
  loadFeaturedPlaylistsError,
  loadFeaturedPlaylistsSuccess,
  loadMoreFeaturedPlaylists,
} from './feature-playlists.action';

export interface FeaturePlaylistsState extends PaginatedState<SpotifyApi.PlaylistObjectSimplified> {
  message: string | null;
}

const initialState: FeaturePlaylistsState = {
  ...createInitialPaginatedState<SpotifyApi.PlaylistObjectSimplified>(SPOTIFY_DEFAULT_LIMIT),
  message: null,
};

export const featuredPlaylistsFeatureKey = 'feature-playlists';

export const featuredPlaylistsReducer = createReducer(
  initialState,
  on(loadFeaturedPlaylists, loadMoreFeaturedPlaylists, (state) => ({
    ...onLoadPage(state),
    message: state.message,
  })),
  on(loadFeaturedPlaylistsSuccess, (state, { response }) => ({
    ...onLoadPageSuccess(state, response.playlists),
    message: response.message || state.message,
  })),
  on(loadFeaturedPlaylistsError, (state, { error }) => ({
    ...onLoadPageError(state, error),
    message: state.message,
  }))
);
