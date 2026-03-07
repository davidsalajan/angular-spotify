import { GenericState } from '@angular-spotify/web/shared/data-access/models';
import { createReducer, on } from '@ngrx/store';
import {
  loadCategoryPlaylists,
  loadCategoryPlaylistsSuccess,
  loadMoreCategoryPlaylists,
  setCategoryPlaylistsState
} from './category-playlists.action';

export const categoryPlaylistsFeatureKey = 'categoryPlaylists';

export interface CategoryPlaylistsEntry {
  items: SpotifyApi.PlaylistObjectSimplified[];
  next: string | null;
  total: number;
  offset: number;
  limit: number;
}

export type CategoryPlaylistsState = GenericState<Map<string, CategoryPlaylistsEntry>>;

const initialState: CategoryPlaylistsState = {
  status: 'pending',
  data: new Map(),
  error: null
};

export const categoryPlaylistsReducer = createReducer(
  initialState,
  on(loadCategoryPlaylists, (state) => ({
    ...state,
    status: 'loading' as const
  })),
  on(loadMoreCategoryPlaylists, (state) => ({
    ...state,
    status: 'loading' as const
  })),
  on(loadCategoryPlaylistsSuccess, (state, { categoryId, playlists }) => {
    const map = new Map(state.data!);
    const existing = map.get(categoryId);
    map.set(categoryId, {
      items: [...(existing?.items || []), ...playlists.items],
      next: playlists.next,
      total: playlists.total,
      offset: playlists.offset,
      limit: playlists.limit,
    });
    return {
      ...state,
      data: map,
      status: 'success' as const
    };
  }),
  on(setCategoryPlaylistsState, (state, { status }) => ({ ...state, status }))
);
