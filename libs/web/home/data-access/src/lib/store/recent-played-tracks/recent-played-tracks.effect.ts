import { Injectable } from '@angular/core';
import { PlayerApiService, SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { select, Store } from '@ngrx/store';
import { EMPTY } from 'rxjs';
import { catchError, filter, map, switchMap, withLatestFrom } from 'rxjs/operators';
import { loadRecentTracks, loadMoreRecentTracks, loadRecentTracksSuccess } from './recent-played-tracks.action';
import { getRecentPlayedTracksState } from './recent-played-tracks.selector';

@Injectable({ providedIn: 'root' })
export class RecentPlayedTracksEffect {
  constructor(
    private playerApi: PlayerApiService,
    private actions$: Actions,
    private store: Store
  ) {}

  loadRecentTracks$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadRecentTracks),
      withLatestFrom(this.store.pipe(select(getRecentPlayedTracksState))),
      filter(([, state]) => !state.data),
      switchMap(() =>
        this.playerApi.getRecentPlayedTracks({ limit: SPOTIFY_DEFAULT_LIMIT }).pipe(
          map((response) => loadRecentTracksSuccess({ response })),
          catchError(() => EMPTY)
        )
      )
    )
  );

  loadMoreRecentTracks$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadMoreRecentTracks),
      withLatestFrom(this.store.pipe(select(getRecentPlayedTracksState))),
      filter(([, state]) => state.next !== null && state.status !== 'loading'),
      switchMap(([, state]) =>
        this.playerApi
          .getRecentPlayedTracks({ limit: SPOTIFY_DEFAULT_LIMIT, after: state.afterCursor! })
          .pipe(
            map((response) => loadRecentTracksSuccess({ response })),
            catchError(() => EMPTY)
          )
      )
    )
  );
}
