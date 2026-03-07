import { GenericStoreStatus } from '@angular-spotify/web/shared/data-access/models';
import { SearchApiService, SearchResponse, SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
import { SelectorUtil } from '@angular-spotify/web/shared/utils';
import { Injectable } from '@angular/core';
import { ComponentStore, tapResponse } from '@ngrx/component-store';
import { filter, switchMap, tap } from 'rxjs/operators';

interface SearchState {
  tracks: SpotifyApi.TrackObjectFull[];
  artists: SpotifyApi.ArtistObjectFull[];
  albums: SpotifyApi.AlbumObjectSimplified[];
  playlists: SpotifyApi.PlaylistObjectSimplified[];
  next: string | null;
  offset: number;
  limit: number;
  currentTerm: string;
  status: GenericStoreStatus;
  error: string | null;
}

const initialState: SearchState = {
  tracks: [],
  artists: [],
  albums: [],
  playlists: [],
  next: null,
  offset: 0,
  limit: SPOTIFY_DEFAULT_LIMIT,
  currentTerm: '',
  status: 'pending',
  error: null,
};

@Injectable()
export class SearchStore extends ComponentStore<SearchState> {
  readonly tracks$ = this.select((s) => s.tracks);
  readonly artists$ = this.select((s) => s.artists);
  readonly albums$ = this.select((s) => s.albums);
  readonly playlists$ = this.select((s) => s.playlists);
  readonly isLoading$ = this.select((s) => s.status === 'loading');
  readonly hasMore$ = this.select((s) => s.next !== null);

  readonly hasResults$ = this.select(
    this.tracks$,
    this.artists$,
    this.albums$,
    this.playlists$,
    (tracks, artists, albums, playlists) =>
      tracks.length > 0 || artists.length > 0 || albums.length > 0 || playlists.length > 0
  );

  search = this.effect<string>((params$) =>
    params$.pipe(
      filter((term) => !!term),
      tap((term) =>
        this.patchState({
          ...initialState,
          currentTerm: term,
          status: 'loading',
        })
      ),
      switchMap((term) =>
        this.searchApiService.search(term, { limit: SPOTIFY_DEFAULT_LIMIT, offset: 0 }).pipe(
          tapResponse(
            (data) => {
              this.patchState({
                tracks: data.tracks?.items || [],
                artists: data.artists?.items || [],
                albums: data.albums?.items || [],
                playlists: data.playlists?.items || [],
                next: data.tracks?.next || null,
                offset: 0,
                limit: SPOTIFY_DEFAULT_LIMIT,
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
        const nextOffset = state.offset + state.limit;
        return this.searchApiService
          .search(state.currentTerm, { limit: state.limit, offset: nextOffset })
          .pipe(
            tapResponse(
              (data) => {
                const current = this.get();
                this.patchState({
                  tracks: [...current.tracks, ...(data.tracks?.items || [])],
                  artists: [...current.artists, ...(data.artists?.items || [])],
                  albums: [...current.albums, ...(data.albums?.items || [])],
                  playlists: [...current.playlists, ...(data.playlists?.items || [])],
                  next: data.tracks?.next || null,
                  offset: nextOffset,
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

  constructor(private searchApiService: SearchApiService) {
    super(initialState);
  }
}
