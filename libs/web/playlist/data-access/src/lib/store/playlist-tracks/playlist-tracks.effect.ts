import { PlaylistApiService, SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { select, Store } from '@ngrx/store';
import { EMPTY } from 'rxjs';
import { catchError, filter, map, switchMap, tap, withLatestFrom } from 'rxjs/operators';
import { getPlaylistTracksState } from './playlist-tracks.selector';
import {
  loadPlaylistTracks,
  loadPlaylistTracksSuccess,
  loadMorePlaylistTracks,
  setPlaylistTracksStateStatus
} from './playlist-tracks.action';

@Injectable({ providedIn: 'root' })
export class PlaylistTracksEffect {
  loadPlaylistTracks$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadPlaylistTracks),
      withLatestFrom(this.store.pipe(select(getPlaylistTracksState))),
      tap(([{ playlistId }, playlistTracks]) => {
        if (playlistTracks.data?.has(playlistId)) {
          this.store.dispatch(
            setPlaylistTracksStateStatus({
              status: 'success'
            })
          );
        }
      }),
      filter(([{ playlistId }, playlistTracks]) => {
        return !playlistTracks.data?.has(playlistId);
      }),
      switchMap(([{ playlistId }]) =>
        this.playlistsApi.getTracks(playlistId, { limit: SPOTIFY_DEFAULT_LIMIT, offset: 0 }).pipe(
          map((playlistTracks) =>
            loadPlaylistTracksSuccess({
              playlistId,
              playlistTracks
            })
          ),
          catchError(() => EMPTY)
        )
      )
    )
  );

  loadMorePlaylistTracks$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadMorePlaylistTracks),
      withLatestFrom(this.store.pipe(select(getPlaylistTracksState))),
      filter(([{ playlistId }, state]) => {
        const entry = state.data?.get(playlistId);
        return !!entry && entry.next !== null;
      }),
      switchMap(([{ playlistId }, state]) => {
        const entry = state.data!.get(playlistId)!;
        return this.playlistsApi
          .getTracks(playlistId, { limit: entry.limit, offset: entry.offset + entry.limit })
          .pipe(
            map((playlistTracks) => loadPlaylistTracksSuccess({ playlistId, playlistTracks })),
            catchError(() => EMPTY)
          );
      })
    )
  );

  constructor(
    private actions$: Actions,
    private playlistsApi: PlaylistApiService,
    private store: Store
  ) {}
}
