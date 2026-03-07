import { BrowseApiService, SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { select, Store } from '@ngrx/store';
import { EMPTY } from 'rxjs';
import { catchError, filter, map, switchMap, tap, withLatestFrom } from 'rxjs/operators';
import {
  loadCategoryPlaylists,
  loadCategoryPlaylistsSuccess,
  loadMoreCategoryPlaylists,
  setCategoryPlaylistsState
} from './category-playlists.action';
import { getCategoryPlaylistsMap, getCategoryPlaylistsState } from './category-playlists.selector';

@Injectable()
export class CategoryPlaylistsEffect {
  loadCategoryPlaylists$ = createEffect(() =>
    this.actions.pipe(
      ofType(loadCategoryPlaylists),
      withLatestFrom(this.store.pipe(select(getCategoryPlaylistsMap))),
      tap(([{ categoryId }, map]) => {
        if (map?.has(categoryId)) {
          this.store.dispatch(
            setCategoryPlaylistsState({
              status: 'success'
            })
          );
        }
      }),
      filter(([{ categoryId }, map]) => {
        return !map?.has(categoryId);
      }),
      switchMap(([{ categoryId }]) =>
        this.browseApi.getCategoryPlaylists(categoryId, { limit: SPOTIFY_DEFAULT_LIMIT, offset: 0 }).pipe(
          map((playlists) =>
            loadCategoryPlaylistsSuccess({
              categoryId,
              playlists
            })
          ),
          catchError(() => EMPTY)
        )
      )
    )
  );

  loadMoreCategoryPlaylists$ = createEffect(() =>
    this.actions.pipe(
      ofType(loadMoreCategoryPlaylists),
      withLatestFrom(
        this.store.pipe(select(getCategoryPlaylistsMap)),
        this.store.pipe(select(getCategoryPlaylistsState))
      ),
      filter(([{ categoryId }, categoryMap, state]) => {
        const entry = categoryMap?.get(categoryId);
        return !!entry && entry.next !== null;
      }),
      switchMap(([{ categoryId }, categoryMap]) => {
        const entry = categoryMap!.get(categoryId)!;
        return this.browseApi
          .getCategoryPlaylists(categoryId, {
            limit: entry.limit,
            offset: entry.offset + entry.limit
          })
          .pipe(
            map((playlists) =>
              loadCategoryPlaylistsSuccess({
                categoryId,
                playlists
              })
            ),
            catchError(() => EMPTY)
          );
      })
    )
  );

  constructor(
    private browseApi: BrowseApiService,
    private actions: Actions,
    private store: Store
  ) {}
}
