import { selectHasMore } from '@angular-spotify/web/shared/data-access/models';
import { PlaylistApiService, SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { select, Store } from '@ngrx/store';
import { EMPTY } from 'rxjs';
import { catchError, filter, map, switchMap, withLatestFrom } from 'rxjs/operators';
import { loadPlaylists, loadMorePlaylists, loadPlaylistsSuccess } from './playlists.action';
import { getPlaylistsState } from './playlists.selector';

@Injectable({ providedIn: 'root' })
export class PlaylistsEffect {
  loadPlaylists$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadPlaylists),
      withLatestFrom(this.store.pipe(select(getPlaylistsState))),
      filter(([, state]) => !state.data),
      switchMap(() =>
        this.playlistsApi.getUserSavedPlaylists({ limit: SPOTIFY_DEFAULT_LIMIT, offset: 0 }).pipe(
          map((playlists) => loadPlaylistsSuccess({ playlists })),
          catchError(() => EMPTY)
        )
      )
    )
  );

  loadMorePlaylists$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadMorePlaylists),
      withLatestFrom(this.store.pipe(select(getPlaylistsState))),
      filter(([, state]) => selectHasMore(state) && state.status !== 'loading'),
      switchMap(([, state]) =>
        this.playlistsApi
          .getUserSavedPlaylists({
            limit: state.limit,
            offset: state.offset + state.limit,
          })
          .pipe(
            map((playlists) => loadPlaylistsSuccess({ playlists })),
            catchError(() => EMPTY)
          )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private playlistsApi: PlaylistApiService,
    private store: Store
  ) {}
}
