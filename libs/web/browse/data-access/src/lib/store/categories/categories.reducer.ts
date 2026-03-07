import {
  PaginatedState,
  createInitialPaginatedState,
  onLoadPage,
  onLoadPageSuccess,
} from '@angular-spotify/web/shared/data-access/models';
import { SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
import { createReducer, on } from '@ngrx/store';
import { loadCategories, loadMoreCategories, loadCategoriesSuccess } from './categories.action';
export const categoriesFeatureKey = 'categories';

export interface CategoriesState extends PaginatedState<SpotifyApi.CategoryObject> {
  map: Map<string, SpotifyApi.CategoryObject>;
}

const initialState: CategoriesState = {
  ...createInitialPaginatedState<SpotifyApi.CategoryObject>(SPOTIFY_DEFAULT_LIMIT),
  map: new Map()
};

export const categoriesReducer = createReducer(
  initialState,
  on(loadCategories, (state) => ({ ...state, ...onLoadPage(state) })),
  on(loadMoreCategories, (state) => ({ ...state, ...onLoadPage(state) })),
  on(loadCategoriesSuccess, (state, { categories }) => {
    const map = new Map(state.map);
    categories.items.forEach((category) => {
      map.set(category.id, category);
    });
    return {
      ...state,
      ...onLoadPageSuccess(state, categories),
      map
    };
  })
);
