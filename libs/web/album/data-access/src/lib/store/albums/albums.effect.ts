import { selectHasMore } from '@angular-spotify/web/shared/data-access/models';
import { AlbumApiService, SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { select, Store } from '@ngrx/store';
import { EMPTY } from 'rxjs';
import { catchError, filter, map, switchMap, withLatestFrom } from 'rxjs/operators';
import { loadAlbums, loadMoreAlbums, loadAlbumsSuccess } from './albums.action';
import { getAlbumsState } from './albums.selector';

@Injectable({ providedIn: 'root' })
export class AlbumsEffect {
  loadAlbums$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadAlbums),
      withLatestFrom(this.store.pipe(select(getAlbumsState))),
      filter(([, state]) => !state.data),
      switchMap(() =>
        this.albumApi.getUserSavedAlbums({ limit: SPOTIFY_DEFAULT_LIMIT, offset: 0 }).pipe(
          map((albums) => loadAlbumsSuccess({ albums })),
          catchError(() => EMPTY)
        )
      )
    )
  );

  loadMoreAlbums$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadMoreAlbums),
      withLatestFrom(this.store.pipe(select(getAlbumsState))),
      filter(([, state]) => selectHasMore(state)),
      switchMap(([, state]) =>
        this.albumApi
          .getUserSavedAlbums({
            limit: state.limit,
            offset: state.offset + state.limit,
          })
          .pipe(
            map((albums) => loadAlbumsSuccess({ albums })),
            catchError(() => EMPTY)
          )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private albumApi: AlbumApiService,
    private store: Store
  ) {}
}
