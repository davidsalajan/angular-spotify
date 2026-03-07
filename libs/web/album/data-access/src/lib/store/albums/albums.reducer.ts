import {
  PaginatedState,
  createInitialPaginatedState,
  onLoadPage,
  onLoadPageSuccess,
  onLoadPageError,
} from '@angular-spotify/web/shared/data-access/models';
import { SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
import { createReducer, on } from '@ngrx/store';
import { loadAlbums, loadMoreAlbums, loadAlbumsError, loadAlbumsSuccess } from './albums.action';

export const albumsFeatureKey = 'albums';

// eslint-disable-next-line
export interface AlbumsState extends PaginatedState<SpotifyApi.SavedAlbumObject> {}

const initialState: AlbumsState = createInitialPaginatedState<SpotifyApi.SavedAlbumObject>(SPOTIFY_DEFAULT_LIMIT);

export const albumsReducer = createReducer(
  initialState,
  on(loadAlbums, (state) => onLoadPage(state)),
  on(loadMoreAlbums, (state) => onLoadPage(state)),
  on(loadAlbumsSuccess, (state, { albums }) => onLoadPageSuccess(state, albums)),
  on(loadAlbumsError, (state, { error }) => onLoadPageError(state, error))
);
