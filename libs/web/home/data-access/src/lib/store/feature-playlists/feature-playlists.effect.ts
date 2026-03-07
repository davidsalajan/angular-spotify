import { AuthStore } from '@angular-spotify/web/auth/data-access';
import { selectHasMore } from '@angular-spotify/web/shared/data-access/models';
import { BrowseApiService, SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { select, Store } from '@ngrx/store';
import { EMPTY } from 'rxjs';
import { catchError, filter, map, switchMap, withLatestFrom } from 'rxjs/operators';
import { loadFeaturedPlaylists, loadFeaturedPlaylistsSuccess, loadMoreFeaturedPlaylists } from './feature-playlists.action';
import { getFeaturePlaylistsState } from './feature-playlists.selector';

@Injectable({ providedIn: 'root' })
export class FeaturePlaylistsEffect {
  constructor(
    private store: Store,
    private browseApi: BrowseApiService,
    private actions$: Actions,
    private authStore: AuthStore
  ) {}

  loadFeaturedPlaylists$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadFeaturedPlaylists),
      withLatestFrom(this.store.pipe(select(getFeaturePlaylistsState))),
      filter(([, state]) => !state.data),
      withLatestFrom(this.authStore.country$),
      switchMap(([, country]) =>
        this.browseApi
          .getAllFeaturedPlaylists({
            limit: SPOTIFY_DEFAULT_LIMIT,
            country: country || 'VN',
            offset: 0,
          })
          .pipe(
            map((response) =>
              loadFeaturedPlaylistsSuccess({
                response
              })
            ),
            catchError(() => EMPTY)
          )
      )
    )
  );

  loadMoreFeaturedPlaylists$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadMoreFeaturedPlaylists),
      withLatestFrom(this.store.pipe(select(getFeaturePlaylistsState))),
      filter(([, state]) => selectHasMore(state)),
      withLatestFrom(this.authStore.country$),
      switchMap(([[, state], country]) =>
        this.browseApi
          .getAllFeaturedPlaylists({
            limit: state.limit,
            country: country || 'VN',
            offset: state.offset + state.limit,
          })
          .pipe(
            map((response) =>
              loadFeaturedPlaylistsSuccess({
                response
              })
            ),
            catchError(() => EMPTY)
          )
      )
    )
  );
}
