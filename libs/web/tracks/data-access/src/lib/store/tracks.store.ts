import { PaginatedState, createInitialPaginatedState, selectHasMore } from '@angular-spotify/web/shared/data-access/models';
import { PlayerApiService, TrackApiService, SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
import { SelectorUtil } from '@angular-spotify/web/shared/utils';
import { Injectable } from '@angular/core';
import { ComponentStore, tapResponse } from '@ngrx/component-store';
import { switchMap, tap } from 'rxjs/operators';

type TracksState = PaginatedState<SpotifyApi.SavedTrackObject>;

@Injectable()
export class TracksStore extends ComponentStore<TracksState> {
  loadTracks = this.effect((params$) =>
    params$.pipe(
      tap(() => this.patchState({ status: 'loading', error: null })),
      switchMap(() =>
        this.trackApi.getUserSavedTracks({ limit: SPOTIFY_DEFAULT_LIMIT, offset: 0 }).pipe(
          tapResponse(
            (response) => {
              this.patchState({
                data: response.items,
                next: response.next,
                total: response.total,
                offset: response.offset,
                limit: response.limit,
                status: 'success',
                error: null,
              });
            },
            (error) => this.patchState({ status: 'error', error: error as unknown as string })
          )
        )
      )
    )
  );

  loadMore = this.effect((params$) =>
    params$.pipe(
      tap(() => this.patchState({ status: 'loading' })),
      switchMap(() => {
        const state = this.get();
        return this.trackApi
          .getUserSavedTracks({ limit: state.limit, offset: state.offset + state.limit })
          .pipe(
            tapResponse(
              (response) => {
                const currentData = this.get().data;
                this.patchState({
                  data: [...(currentData || []), ...response.items],
                  next: response.next,
                  total: response.total,
                  offset: response.offset,
                  limit: response.limit,
                  status: 'success',
                  error: null,
                });
              },
              (error) => this.patchState({ status: 'error', error: error as unknown as string })
            )
          );
      })
    )
  );

  playTrack = this.effect<{ track: SpotifyApi.TrackObjectFull }>((params$) =>
    params$.pipe(
      switchMap(({ track }) =>
        this.playerApi.play({
          context_uri: track.album.uri,
          offset: {
            position: track.track_number - 1
          }
        })
      )
    )
  );

  vm$ = this.select((s) => ({
    ...s,
    isLoading: SelectorUtil.isLoading(s),
    hasMore: selectHasMore(s),
  }));

  constructor(private trackApi: TrackApiService, private playerApi: PlayerApiService) {
    super(createInitialPaginatedState<SpotifyApi.SavedTrackObject>(SPOTIFY_DEFAULT_LIMIT));
  }
}
