import { selectHasMore } from '@angular-spotify/web/shared/data-access/models';
import { BrowseApiService, SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
import { AuthStore } from '@angular-spotify/web/auth/data-access';
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { select, Store } from '@ngrx/store';
import { EMPTY } from 'rxjs';
import { catchError, filter, map, switchMap, withLatestFrom } from 'rxjs/operators';
import { loadCategories, loadMoreCategories, loadCategoriesSuccess } from './categories.action';
import { getCategoriesState } from './categories.selector';

@Injectable()
export class CategoriesEffect {
  loadCategories$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadCategories),
      withLatestFrom(this.store.pipe(select(getCategoriesState))),
      filter(([, state]) => !state.data),
      withLatestFrom(this.authStore.country$),
      switchMap(([, country]) =>
        this.browseApi
          .getAllCategories({
            country,
            limit: SPOTIFY_DEFAULT_LIMIT,
            offset: 0
          })
          .pipe(
            map((categories) => loadCategoriesSuccess({ categories })),
            catchError(() => EMPTY)
          )
      )
    )
  );

  loadMoreCategories$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadMoreCategories),
      withLatestFrom(this.store.pipe(select(getCategoriesState))),
      filter(([, state]) => selectHasMore(state) && state.status !== 'loading'),
      withLatestFrom(this.authStore.country$),
      switchMap(([[ , state], country]) =>
        this.browseApi
          .getAllCategories({
            country,
            limit: state.limit,
            offset: state.offset + state.limit,
          })
          .pipe(
            map((categories) => loadCategoriesSuccess({ categories })),
            catchError(() => EMPTY)
          )
      )
    )
  );

  constructor(
    private store: Store,
    private actions$: Actions,
    private browseApi: BrowseApiService,
    private authStore: AuthStore
  ) {}
}
