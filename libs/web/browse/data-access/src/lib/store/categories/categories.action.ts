import { createAction, props } from '@ngrx/store';

export const loadCategories = createAction(
  '[Browse Page]/Load Categories'
);

export const loadMoreCategories = createAction(
  '[Browse Page]/Load More Categories'
);

export const loadCategoriesSuccess = createAction(
  '[Browse Page/Load Categories Success',
  props<{
    categories: SpotifyApi.PagingObject<SpotifyApi.CategoryObject>;
  }>()
);
