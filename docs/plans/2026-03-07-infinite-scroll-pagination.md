# Infinite Scroll Pagination Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add infinite scroll pagination to all list views in the Angular Spotify app, matching Spotify's native scrolling experience.

**Architecture:** Create a shared `PaginatedState<T>` type with reducer helpers, a custom `InfiniteScrollDirective` using IntersectionObserver, then migrate all 8 stores (4 global NgRx + 4 ComponentStore) to accumulate paginated data. Each list view gets a sentinel element that triggers loading the next page.

**Tech Stack:** Angular 17, NgRx 17, RxJS, IntersectionObserver API, TypeScript

---

### Task 1: Add `SPOTIFY_DEFAULT_LIMIT` Constant

**Files:**
- Create: `libs/web/shared/data-access/spotify-api/src/lib/spotify-api.constant.ts`
- Modify: `libs/web/shared/data-access/spotify-api/src/index.ts`
- Modify: `libs/web/shared/data-access/spotify-api/src/lib/playlist-api.ts`
- Modify: `libs/web/shared/data-access/spotify-api/src/lib/album-api.ts`
- Modify: `libs/web/shared/data-access/spotify-api/src/lib/browse-api.ts`
- Modify: `libs/web/shared/data-access/spotify-api/src/lib/search-api.ts`
- Modify: `libs/web/shared/data-access/spotify-api/src/lib/track-api.ts`
- Modify: `libs/web/shared/data-access/spotify-api/src/lib/player-api.ts`
- Modify: `libs/web/home/data-access/src/lib/store/feature-playlists/feature-playlists.effect.ts`
- Modify: `libs/web/browse/data-access/src/lib/store/categories/categories.effect.ts`

**Step 1: Create the constant file**

```typescript
// libs/web/shared/data-access/spotify-api/src/lib/spotify-api.constant.ts
export const SPOTIFY_DEFAULT_LIMIT = 50;
```

**Step 2: Export from barrel**

Add to `libs/web/shared/data-access/spotify-api/src/index.ts`:
```typescript
export * from './lib/spotify-api.constant';
```

**Step 3: Replace all magic `50` values in API services**

In each API service file, add import:
```typescript
import { SPOTIFY_DEFAULT_LIMIT } from './spotify-api.constant';
```

Then replace `limit: 50` with `limit: SPOTIFY_DEFAULT_LIMIT` in default params.

Files to update:
- `playlist-api.ts` line 12: `limit: 50` → `limit: SPOTIFY_DEFAULT_LIMIT`
- `album-api.ts` lines 12, 29: `limit: 50` → `limit: SPOTIFY_DEFAULT_LIMIT`
- `browse-api.ts` lines 15, 28, 41: `limit: 50` → `limit: SPOTIFY_DEFAULT_LIMIT`
- `search-api.ts` line 24: `limit: 50` → `limit: SPOTIFY_DEFAULT_LIMIT`
- `track-api.ts` line 24: `limit: 50` → `limit: SPOTIFY_DEFAULT_LIMIT`
- `player-api.ts` line 61: `limit: 50` → `limit: SPOTIFY_DEFAULT_LIMIT`

Also update effects that hardcode `limit: 50`:
- `feature-playlists.effect.ts` line 24: `limit: 50` → `limit: SPOTIFY_DEFAULT_LIMIT` (import from `@angular-spotify/web/shared/data-access/spotify-api`)
- `categories.effect.ts` line 27: `limit: 50` → `limit: SPOTIFY_DEFAULT_LIMIT` (import from `@angular-spotify/web/shared/data-access/spotify-api`)

**Step 4: Fix `playlist-api.ts` `getTracks()` to accept params**

```typescript
// Before (line 32-38):
getTracks(playlistId: string) {
  if (!playlistId) {
    throw new Error('Playlist Id is required');
  }
  return this.http.get<SpotifyApi.PlaylistTrackResponse>(
    `${this.appConfig.baseURL}/playlists/${playlistId}/tracks`
  );
}

// After:
getTracks(playlistId: string, params: SpotifyApiParams = { limit: SPOTIFY_DEFAULT_LIMIT }) {
  if (!playlistId) {
    throw new Error('Playlist Id is required');
  }
  return this.http.get<SpotifyApi.PlaylistTrackResponse>(
    `${this.appConfig.baseURL}/playlists/${playlistId}/tracks`,
    { params }
  );
}
```

Add `SpotifyApiParams` import if not already present (it is in playlist-api.ts).

**Step 5: Build and verify**

Run: `npx nx build web-shared-data-access-spotify-api --skip-nx-cache`
Expected: Build succeeds with no errors.

**Step 6: Commit**

```bash
git add libs/web/shared/data-access/spotify-api/ libs/web/home/data-access/src/lib/store/feature-playlists/feature-playlists.effect.ts libs/web/browse/data-access/src/lib/store/categories/categories.effect.ts
git commit -m "refactor: extract SPOTIFY_DEFAULT_LIMIT constant and fix playlist getTracks params"
```

---

### Task 2: Add `PaginatedState<T>` Type and Reducer Helpers

**Files:**
- Create: `libs/web/shared/data-access/models/src/lib/store/paginated-state.ts`
- Modify: `libs/web/shared/data-access/models/src/lib/store/index.ts`

**Step 1: Create `PaginatedState<T>` and helpers**

```typescript
// libs/web/shared/data-access/models/src/lib/store/paginated-state.ts
import { GenericState } from './generic-state';

export interface PaginatedState<T> extends GenericState<T[]> {
  next: string | null;
  total: number;
  offset: number;
  limit: number;
}

export function createInitialPaginatedState<T>(limit: number): PaginatedState<T> {
  return {
    data: null,
    status: 'pending',
    error: null,
    next: null,
    total: 0,
    offset: 0,
    limit,
  };
}

export function onLoadPage<T>(state: PaginatedState<T>): PaginatedState<T> {
  return { ...state, status: 'loading' as const };
}

export function onLoadPageSuccess<T>(
  state: PaginatedState<T>,
  pagingObject: { items: T[]; next: string | null; total: number; offset: number; limit: number }
): PaginatedState<T> {
  return {
    ...state,
    data: [...(state.data || []), ...pagingObject.items],
    next: pagingObject.next,
    total: pagingObject.total,
    offset: pagingObject.offset,
    limit: pagingObject.limit,
    status: 'success' as const,
    error: null,
  };
}

export function onLoadPageError<T>(state: PaginatedState<T>, error: string): PaginatedState<T> {
  return { ...state, status: 'error' as const, error };
}

export function selectHasMore<T>(state: PaginatedState<T>): boolean {
  return state.next !== null;
}
```

**Step 2: Export from barrel**

Add to `libs/web/shared/data-access/models/src/lib/store/index.ts`:
```typescript
export * from './paginated-state';
```

**Step 3: Build and verify**

Run: `npx nx build web-shared-data-access-models --skip-nx-cache`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add libs/web/shared/data-access/models/
git commit -m "feat: add PaginatedState type and reducer helper functions"
```

---

### Task 3: Create `InfiniteScrollDirective`

**Files:**
- Create: `libs/web/shared/ui/infinite-scroll/src/index.ts`
- Create: `libs/web/shared/ui/infinite-scroll/src/lib/infinite-scroll.directive.ts`
- Create: `libs/web/shared/ui/infinite-scroll/src/lib/infinite-scroll.directive.spec.ts`
- Modify: `tsconfig.base.json` (add path alias)

**Step 1: Add path alias to `tsconfig.base.json`**

Add to the `paths` object:
```json
"@angular-spotify/web/shared/ui/infinite-scroll": [
  "libs/web/shared/ui/infinite-scroll/src/index.ts"
]
```

**Step 2: Create the directive**

```typescript
// libs/web/shared/ui/infinite-scroll/src/lib/infinite-scroll.directive.ts
import { Directive, ElementRef, OnDestroy, OnInit, input, output } from '@angular/core';

@Directive({
  selector: '[asInfiniteScroll]',
  standalone: true,
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {
  enabled = input(true);
  scrolledToBottom = output<void>();

  private observer: IntersectionObserver | null = null;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit() {
    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && this.enabled()) {
          this.scrolledToBottom.emit();
        }
      },
      { threshold: 0.1 }
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
```

**Step 3: Create barrel export**

```typescript
// libs/web/shared/ui/infinite-scroll/src/index.ts
export * from './lib/infinite-scroll.directive';
```

**Step 4: Write test**

```typescript
// libs/web/shared/ui/infinite-scroll/src/lib/infinite-scroll.directive.spec.ts
import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { InfiniteScrollDirective } from './infinite-scroll.directive';

@Component({
  standalone: true,
  imports: [InfiniteScrollDirective],
  template: `<div asInfiniteScroll [enabled]="enabled" (scrolledToBottom)="onScroll()"></div>`,
})
class TestComponent {
  enabled = true;
  scrollCount = 0;
  onScroll() {
    this.scrollCount++;
  }
}

describe('InfiniteScrollDirective', () => {
  let fixture: ComponentFixture<TestComponent>;
  let component: TestComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestComponent],
    });
    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the directive', () => {
    const el = fixture.nativeElement.querySelector('[asInfiniteScroll]');
    expect(el).toBeTruthy();
  });
});
```

**Step 5: Build and verify**

Run: `npx nx build angular-spotify --skip-nx-cache` (or whichever build target includes this lib)
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add libs/web/shared/ui/infinite-scroll/ tsconfig.base.json
git commit -m "feat: add InfiniteScrollDirective using IntersectionObserver"
```

---

### Task 4: Migrate Playlists Store (Global NgRx)

This is the reference implementation. All other NgRx stores will follow this pattern.

**Files:**
- Modify: `libs/web/playlist/data-access/src/lib/store/playlists/playlists.action.ts`
- Modify: `libs/web/playlist/data-access/src/lib/store/playlists/playlists.reducer.ts`
- Modify: `libs/web/playlist/data-access/src/lib/store/playlists/playlists.effect.ts`
- Modify: `libs/web/playlist/data-access/src/lib/store/playlists/playlists.selector.ts`
- Modify: `libs/web/shared/utils/src/lib/selector-util.ts`
- Modify: `libs/web/playlist/feature/list/src/lib/playlists.component.ts`
- Modify: `libs/web/playlist/feature/list/src/lib/playlists.component.html`
- Modify: `libs/web/shared/ui/playlist-list/src/lib/playlist-list.component.ts`
- Modify: `libs/web/shared/ui/playlist-list/src/lib/playlist-list.component.html`

**Step 1: Update actions**

```typescript
// libs/web/playlist/data-access/src/lib/store/playlists/playlists.action.ts
import { createAction, props } from '@ngrx/store';

export const loadPlaylists = createAction('[Playlists Store/API]');

export const loadMorePlaylists = createAction('[Playlists Store/Load More]');

export const loadPlaylistsSuccess = createAction(
  '[Playlists Store/API success]',
  props<{
    playlists: SpotifyApi.ListOfUsersPlaylistsResponse;
  }>()
);

export const loadPlaylistsError = createAction(
  '[Playlists Store/API error]',
  props<{ error: string }>()
);

export const loadPlaylistSuccess = createAction(
  '[Playlists Store/Load Playlist By Id success]',
  props<{
    playlist: SpotifyApi.PlaylistObjectSimplified;
  }>()
);
```

**Step 2: Update reducer**

```typescript
// libs/web/playlist/data-access/src/lib/store/playlists/playlists.reducer.ts
import {
  PaginatedState,
  createInitialPaginatedState,
  onLoadPage,
  onLoadPageSuccess,
  onLoadPageError,
} from '@angular-spotify/web/shared/data-access/models';
import { SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
import { createReducer, on } from '@ngrx/store';
import {
  loadPlaylists,
  loadMorePlaylists,
  loadPlaylistsError,
  loadPlaylistsSuccess,
  loadPlaylistSuccess,
} from './playlists.action';

export const playlistsFeatureKey = 'playlists';

export interface PlaylistsState extends PaginatedState<SpotifyApi.PlaylistObjectSimplified> {
  map: Map<string, SpotifyApi.PlaylistObjectSimplified> | null;
}

const initialState: PlaylistsState = {
  ...createInitialPaginatedState<SpotifyApi.PlaylistObjectSimplified>(SPOTIFY_DEFAULT_LIMIT),
  map: null,
};

export const playlistsReducer = createReducer(
  initialState,
  on(loadPlaylists, (state) => onLoadPage(state)),
  on(loadMorePlaylists, (state) => onLoadPage(state)),
  on(loadPlaylistsSuccess, (state, { playlists }) => {
    const newState = onLoadPageSuccess(state, playlists);
    const map = new Map<string, SpotifyApi.PlaylistObjectSimplified>(state.map || undefined);
    playlists.items.forEach((playlist) => map.set(playlist.id, playlist));
    return { ...newState, map };
  }),
  on(loadPlaylistsError, (state, { error }) => onLoadPageError(state, error)),
  on(loadPlaylistSuccess, (state, { playlist }) => {
    const map = new Map<string, SpotifyApi.PlaylistObjectSimplified>(state.map || undefined);
    map.set(playlist.id, playlist);
    return { ...state, map };
  })
);
```

**Step 3: Update effect**

```typescript
// libs/web/playlist/data-access/src/lib/store/playlists/playlists.effect.ts
import { PlaylistApiService, SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { select, Store } from '@ngrx/store';
import { EMPTY } from 'rxjs';
import { catchError, filter, map, switchMap, withLatestFrom } from 'rxjs/operators';
import { loadPlaylists, loadMorePlaylists, loadPlaylistsSuccess } from './playlists.action';
import { getPlaylistsState } from './playlists.selector';
import { selectHasMore } from '@angular-spotify/web/shared/data-access/models';

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
```

**Step 4: Update selectors**

```typescript
// libs/web/playlist/data-access/src/lib/store/playlists/playlists.selector.ts
import { selectHasMore } from '@angular-spotify/web/shared/data-access/models';
import { SelectorUtil } from '@angular-spotify/web/shared/utils';
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { playlistsFeatureKey, PlaylistsState } from './playlists.reducer';

export const getPlaylistsState = createFeatureSelector<PlaylistsState>(playlistsFeatureKey);
export const getPlaylistItems = createSelector(getPlaylistsState, (state) => state.data);
export const getPlaylistsLoading = createSelector(getPlaylistsState, SelectorUtil.isLoading);
export const getPlaylistsHasMore = createSelector(getPlaylistsState, selectHasMore);
export const getPlaylistsNext = createSelector(getPlaylistsState, (state) => state.next);
export const getPlaylistsMap = createSelector(getPlaylistsState, (state) => state.map);
export const getPlaylist = (playlistId: string) =>
  createSelector(getPlaylistsMap, (map) => map?.get(playlistId));
```

**Step 5: Update `SelectorUtil.getPlaylistsWithRoute`**

The current method expects `ListOfUsersPlaylistsResponse` (which has `.items`). Now `data` is a flat array. Update `selector-util.ts`:

```typescript
// In libs/web/shared/utils/src/lib/selector-util.ts
// Update getPlaylistsWithRoute to accept a flat array:
static getPlaylistsWithRoute(
  playlists: SpotifyApi.PlaylistObjectSimplified[] | null | undefined
): (SpotifyApi.PlaylistObjectSimplified & { routeUrl: string })[] | null | undefined {
  if (playlists) {
    return playlists.map((item) => ({
      ...item,
      routeUrl: RouteUtil.getPlaylistRouteUrl(item.id),
    }));
  }
  return playlists;
}
```

Also update the `PlaylistsResponseWithRoute` type in `libs/web/shared/data-access/models/src/lib/api/playlists-with-route.ts` if needed — check what it currently is and align it with the new flat array shape.

**Step 6: Update `PlaylistListComponent` to accept flat array + infinite scroll**

```typescript
// libs/web/shared/ui/playlist-list/src/lib/playlist-list.component.ts
// Add inputs for hasMore and loadMore output
import { ..., Output, EventEmitter } from '@angular/core';

// Add to class:
@Input() hasMore = false;
@Output() loadMore = new EventEmitter<void>();
```

Update template:
```html
<!-- libs/web/shared/ui/playlist-list/src/lib/playlist-list.component.html -->
@if (playlists) {
  <div class="common-grid">
    @for (playlist of playlists; track playlist) {
      <as-card
        [ngClass]="viewTransitionName(playlist)"
        [title]="playlist.name"
        [uri]="playlist.uri"
        [description]="playlist.description"
        [imageUrl]="playlist.images[0]?.url"
        [routerUrl]="playlist.routeUrl"
        (togglePlay)="togglePlay($event, playlist.uri)">
      </as-card>
    }
  </div>
}
<div
  asInfiniteScroll
  [enabled]="hasMore && !isLoading"
  (scrolledToBottom)="loadMore.emit()">
</div>
@if (isLoading) {
  <as-spinner></as-spinner>
}
```

Import `InfiniteScrollDirective` in the module.

**Step 7: Update `PlaylistsComponent`**

```typescript
// libs/web/playlist/feature/list/src/lib/playlists.component.ts
import {
  getPlaylistsLoading,
  getPlaylistsHasMore,
  loadMorePlaylists,
} from '@angular-spotify/web/playlist/data-access';
import { getPlaylistItems } from '@angular-spotify/web/playlist/data-access';
// ... update selectors
import { SelectorUtil } from '@angular-spotify/web/shared/utils';

export class PlaylistsComponent {
  playlists$ = this.store.pipe(
    select(getPlaylistItems),
    map(SelectorUtil.getPlaylistsWithRoute)
  );
  isPlaylistsLoading$ = this.store.pipe(select(getPlaylistsLoading));
  hasMore$ = this.store.pipe(select(getPlaylistsHasMore));

  constructor(private store: Store) {}

  loadMore() {
    this.store.dispatch(loadMorePlaylists());
  }
}
```

Update template:
```html
<!-- libs/web/playlist/feature/list/src/lib/playlists.component.html -->
<div class="content-spacing">
  <as-playlist-list
    [isLoading]="isPlaylistsLoading$ | async"
    [playlists]="$any(playlists$ | async)"
    [hasMore]="!!(hasMore$ | async)"
    (loadMore)="loadMore()">
  </as-playlist-list>
</div>
```

**Step 8: Build and verify**

Run: `npx nx build angular-spotify --skip-nx-cache`
Expected: Build succeeds.

**Step 9: Commit**

```bash
git add libs/web/playlist/ libs/web/shared/
git commit -m "feat(playlists): add infinite scroll pagination to playlists list"
```

---

### Task 5: Migrate Albums Store (Global NgRx)

Follow the same pattern as Task 4.

**Files:**
- Modify: `libs/web/album/data-access/src/lib/store/albums/albums.action.ts`
- Modify: `libs/web/album/data-access/src/lib/store/albums/albums.reducer.ts`
- Modify: `libs/web/album/data-access/src/lib/store/albums/albums.effect.ts`
- Modify: `libs/web/album/data-access/src/lib/store/albums/albums.selector.ts`
- Modify: `libs/web/album/feature/list/src/lib/albums.component.ts`
- Modify: `libs/web/album/feature/list/src/lib/albums.component.html`

**Step 1: Update actions**

Add `loadMoreAlbums` action:
```typescript
export const loadMoreAlbums = createAction('[Albums Page/Load More]');
```

**Step 2: Update reducer**

Change `AlbumsState` to extend `PaginatedState<SpotifyApi.SavedAlbumObject>` instead of `GenericState<SpotifyApi.UsersSavedAlbumsResponse>`.

Use `createInitialPaginatedState`, `onLoadPage`, `onLoadPageSuccess`, `onLoadPageError`.

**Step 3: Update effect**

- Keep `loadAlbums$` for initial load (filter with `!state.data`)
- Add `loadMoreAlbums$` that reads offset from state, checks `selectHasMore`

**Step 4: Update selectors**

- `getAlbums` → returns `state.data` (now `SavedAlbumObject[]`)
- Add `getAlbumsHasMore`
- Add `getAlbumsNext`

**Step 5: Update albums component**

```typescript
// albums.component.ts - add:
hasMore$ = this.store.pipe(select(getAlbumsHasMore));

loadMore() {
  this.store.dispatch(loadMoreAlbums());
}
```

```html
<!-- albums.component.html -->
<div class="content-spacing">
  @if (albums$ | async; as albums) {
    <div class="common-grid">
      @for (item of albums; track item) {
        <as-card
          [ngClass]="viewTransitionName(item)"
          [title]="item.album.name"
          [uri]="item.album.uri"
          [description]="item.album.artists[0].name"
          [imageUrl]="item.album.images[0]?.url"
          [routerUrl]="item.album.id"
          (togglePlay)="togglePlay($event, item.album.uri)">
        </as-card>
      }
    </div>
  }
  <div
    asInfiniteScroll
    [enabled]="!!(hasMore$ | async) && !(isLoading$ | async)"
    (scrolledToBottom)="loadMore()">
  </div>
  @if (isLoading$ | async) {
    <as-spinner></as-spinner>
  }
</div>
```

Import `InfiniteScrollDirective` in the albums module.

**Step 6: Build and verify**

Run: `npx nx build angular-spotify --skip-nx-cache`

**Step 7: Commit**

```bash
git add libs/web/album/
git commit -m "feat(albums): add infinite scroll pagination to albums list"
```

---

### Task 6: Migrate Categories Store (Global NgRx)

**Files:**
- Modify: `libs/web/browse/data-access/src/lib/store/categories/categories.action.ts`
- Modify: `libs/web/browse/data-access/src/lib/store/categories/categories.reducer.ts`
- Modify: `libs/web/browse/data-access/src/lib/store/categories/categories.effect.ts`
- Modify: `libs/web/browse/data-access/src/lib/store/categories/categories.selector.ts`
- Modify: `libs/web/browse/feature/categories/src/lib/categories.component.ts`
- Modify: `libs/web/browse/feature/categories/src/lib/categories.component.html`

**Step 1: Update actions**

Add `loadMoreCategories` action. Remove `setCategoriesState` (no longer needed — the caching logic changes).

**Step 2: Update reducer**

`CategoriesState` extends `PaginatedState<SpotifyApi.CategoryObject>` with `map: Map<string, SpotifyApi.CategoryObject>`.

Use pagination helpers. On success, also update the map.

**Step 3: Update effect**

- `loadCategories$`: initial load, filter with `!state.data`
- `loadMoreCategories$`: reads offset, checks `selectHasMore`
- Remove the `tap` + `setCategoriesState` pattern — replace with the `filter(!state.data)` guard

**Step 4: Update selectors**

- `getCategories` → returns `state.data` (now `CategoryObject[]`)
- Add `getCategoriesHasMore`

**Step 5: Update categories component**

Add `hasMore$`, `loadMore()` method, and `asInfiniteScroll` sentinel div.

Note: template iterates `categories.items` currently — change to iterate `categories` directly since data is now a flat array.

**Step 6: Build and verify**

Run: `npx nx build angular-spotify --skip-nx-cache`

**Step 7: Commit**

```bash
git add libs/web/browse/data-access/src/lib/store/categories/ libs/web/browse/feature/categories/
git commit -m "feat(categories): add infinite scroll pagination to categories"
```

---

### Task 7: Migrate Featured Playlists Store (Global NgRx)

**Files:**
- Modify: `libs/web/home/data-access/src/lib/store/feature-playlists/feature-playlists.action.ts`
- Modify: `libs/web/home/data-access/src/lib/store/feature-playlists/feature-playlists.reducer.ts`
- Modify: `libs/web/home/data-access/src/lib/store/feature-playlists/feature-playlists.effect.ts`
- Modify: `libs/web/home/data-access/src/lib/store/feature-playlists/feature-playlists.selector.ts`
- Modify: `libs/web/home/ui/featured-playlists/src/lib/featured-playlists.component.ts`
- Modify: `libs/web/home/ui/featured-playlists/src/lib/featured-playlists.component.html`

**Step 1: Update actions**

Add `loadMoreFeaturedPlaylists` action.

**Step 2: Update reducer**

Special case: `ListOfFeaturedPlaylistsResponse` has a `message` field alongside `playlists`. Store the `message` separately.

```typescript
export interface FeaturePlaylistsState extends PaginatedState<SpotifyApi.PlaylistObjectSimplified> {
  message: string | null;
}
```

On success, extract `response.playlists` for pagination helpers and `response.message` for the message field.

**Step 3: Update effect**

- `loadFeaturedPlaylists$`: initial load with country param
- `loadMoreFeaturedPlaylists$`: next page with country + offset

**Step 4: Update selectors**

- `getFeaturedPlaylists` → returns `state.data` (flat `PlaylistObjectSimplified[]`)
- `getFeaturedPlaylistsMessage` → returns `state.message`
- `getFeaturedPlaylistsWithRouteUrl` → maps items to add `routeUrl`
- Add `getFeaturedPlaylistsHasMore`

**Step 5: Update featured playlists component**

The template currently reads `data.message` and `data.playlists.items`. Update to read from separate selectors for message and items.

```html
@if (featuredPlaylists$ | async; as playlists) {
  <h2 class="mt-8 mb-4 text-heading">{{ message$ | async }}</h2>
  <div class="common-grid">
    @for (playlist of playlists; track playlist) {
      <as-card
        [title]="playlist.name"
        [description]="playlist.description"
        [imageUrl]="playlist.images[0]?.url!"
        [uri]="playlist.uri"
        [routerUrl]="playlist.routeUrl"
        (togglePlay)="togglePlay($event, playlist.uri)">
      </as-card>
    }
  </div>
}
<div
  asInfiniteScroll
  [enabled]="!!(hasMore$ | async) && !(isLoading$ | async)"
  (scrolledToBottom)="loadMore()">
</div>
@if (isLoading$ | async) {
  <as-spinner></as-spinner>
}
```

**Step 6: Build and verify**

Run: `npx nx build angular-spotify --skip-nx-cache`

**Step 7: Commit**

```bash
git add libs/web/home/
git commit -m "feat(home): add infinite scroll pagination to featured playlists"
```

---

### Task 8: Migrate Category Playlists Store (Global NgRx — Map-based)

This is more complex because the store holds a `Map<categoryId, PagingObject>`.

**Files:**
- Modify: `libs/web/browse/data-access/src/lib/store/category-playlists/category-playlists.action.ts`
- Modify: `libs/web/browse/data-access/src/lib/store/category-playlists/category-playlists.reducer.ts`
- Modify: `libs/web/browse/data-access/src/lib/store/category-playlists/category-playlists.effect.ts`
- Modify: `libs/web/browse/data-access/src/lib/store/category-playlists/category-playlists.selector.ts`
- Check/modify: category detail component (browse/feature/category/)

**Step 1: Update actions**

Add `loadMoreCategoryPlaylists` with `categoryId` prop.

**Step 2: Update reducer**

The state shape changes: `Map<string, PagingObject>` → `Map<string, { items: PlaylistObjectSimplified[]; next: string | null; total: number; offset: number; limit: number }>`.

On `loadMoreCategoryPlaylistsSuccess`, append items to existing entry in map.

**Step 3: Update effect**

`loadMoreCategoryPlaylists$`: read the current entry for the category from the map, use its offset + limit for the next call.

**Step 4: Update selectors**

`getCategoryPlaylistsById(categoryId)`: returns the accumulated items array, applies route URL mapping.

Also expose `getCategoryPlaylistsHasMore(categoryId)`.

**Step 5: Update category component**

Add `hasMore$`, `loadMore()`, and sentinel div.

**Step 6: Build and verify**

Run: `npx nx build angular-spotify --skip-nx-cache`

**Step 7: Commit**

```bash
git add libs/web/browse/
git commit -m "feat(browse): add infinite scroll pagination to category playlists"
```

---

### Task 9: Migrate Playlist Tracks Store (Global NgRx — Map-based)

Similar to Task 8 — the playlist tracks store also uses a Map keyed by playlistId.

**Files:**
- Modify: `libs/web/playlist/data-access/src/lib/store/playlist-tracks/playlist-tracks.action.ts`
- Modify: `libs/web/playlist/data-access/src/lib/store/playlist-tracks/playlist-tracks.reducer.ts`
- Modify: `libs/web/playlist/data-access/src/lib/store/playlist-tracks/playlist-tracks.effect.ts` (check for this file)
- Modify: `libs/web/playlist/data-access/src/lib/store/playlist-tracks/playlist-tracks.selector.ts`
- Modify: `libs/web/playlist/data-access/src/lib/store/playlist/playlist.store.ts`
- Modify: playlist detail component template

**Step 1: Update actions**

Add `loadMorePlaylistTracks` with `playlistId` prop.

**Step 2: Update reducer**

Change Map value from `PlaylistTrackResponse` to `{ items: PlaylistTrackObject[]; next: string | null; total: number; offset: number; limit: number }`.

On success, append items.

**Step 3: Update effect**

Use the new `getTracks(playlistId, { limit, offset })` from the API fix in Task 1.

**Step 4: Update selectors**

`getPlaylistTracksById(playlistId)` returns accumulated items.
Add `getPlaylistTracksHasMore(playlistId)`.

**Step 5: Update playlist detail component**

Add sentinel div and loadMore capability.

**Step 6: Build and verify**

**Step 7: Commit**

```bash
git add libs/web/playlist/
git commit -m "feat(playlist): add infinite scroll pagination to playlist tracks"
```

---

### Task 10: Migrate Saved Tracks Store (ComponentStore)

**Files:**
- Modify: `libs/web/tracks/data-access/src/lib/store/tracks.store.ts`
- Modify: `libs/web/tracks/feature/src/lib/tracks.component.ts`
- Modify: `libs/web/tracks/feature/src/lib/tracks.component.html`

**Step 1: Update store state and effects**

```typescript
// libs/web/tracks/data-access/src/lib/store/tracks.store.ts
import { PaginatedState, createInitialPaginatedState, selectHasMore } from '@angular-spotify/web/shared/data-access/models';
import { TrackApiService, PlayerApiService, SPOTIFY_DEFAULT_LIMIT } from '@angular-spotify/web/shared/data-access/spotify-api';
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
                this.patchState({
                  data: [...(state.data || []), ...response.items],
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
          offset: { position: track.track_number - 1 },
        })
      )
    )
  );

  readonly hasMore$ = this.select((s) => selectHasMore(s));

  vm$ = this.select((s) => ({
    ...s,
    isLoading: SelectorUtil.isLoading(s),
    hasMore: selectHasMore(s),
  }));

  constructor(private trackApi: TrackApiService, private playerApi: PlayerApiService) {
    super(createInitialPaginatedState<SpotifyApi.SavedTrackObject>(SPOTIFY_DEFAULT_LIMIT));
  }
}
```

**Step 2: Update tracks component**

```typescript
// tracks.component.ts - add:
loadMore() {
  this.store.loadMore();
}
```

```html
<!-- tracks.component.html - add sentinel after the tracks list -->
<!-- After the mb-8 div closing tag, before the loading check: -->
<div
  asInfiniteScroll
  [enabled]="vm.hasMore && !vm.isLoading"
  (scrolledToBottom)="loadMore()">
</div>
```

Import `InfiniteScrollDirective` in the tracks module.

Note: template accesses `vm.data?.items` — update to `vm.data` since data is now a flat `SavedTrackObject[]`.

**Step 3: Build and verify**

**Step 4: Commit**

```bash
git add libs/web/tracks/
git commit -m "feat(tracks): add infinite scroll pagination to saved tracks"
```

---

### Task 11: Migrate Search Store (ComponentStore)

Search is special — it has 4 paginated sections (tracks, artists, albums, playlists). For initial implementation, increase the search limit from 8 to `SPOTIFY_DEFAULT_LIMIT` and add a single infinite scroll that loads more of all types.

**Files:**
- Modify: `libs/web/search/data-access/src/lib/store/search.store.ts`
- Modify: `libs/web/search/feature/src/lib/search.component.ts`
- Modify: `libs/web/search/feature/src/lib/search.component.html`

**Step 1: Update search store**

The search response has 4 separate `PagingObject` fields. Track pagination metadata per section, or keep it simple and use the `tracks.next` as the sentinel (since all 4 share the same offset/limit).

Simpler approach: store accumulated results per type, track offset/limit globally.

```typescript
interface SearchPaginatedState {
  tracks: SpotifyApi.TrackObjectFull[];
  artists: SpotifyApi.ArtistObjectFull[];
  albums: SpotifyApi.AlbumObjectSimplified[];
  playlists: SpotifyApi.PlaylistObjectSimplified[];
  next: string | null; // use tracks.next as proxy
  total: number;
  offset: number;
  limit: number;
  status: GenericStoreStatus;
  error: string | null;
  currentTerm: string;
}
```

On initial search: reset all arrays, store results.
On loadMore: append to each array.

**Step 2: Update search component**

Add `loadMore()` that calls `store.loadMore()`. Add sentinel div at bottom of results.

Update template to iterate over flat arrays instead of `data?.tracks?.items`.

**Step 3: Build and verify**

**Step 4: Commit**

```bash
git add libs/web/search/
git commit -m "feat(search): add infinite scroll pagination to search results"
```

---

### Task 12: Migrate Recent Played Tracks Store (Global NgRx)

**Note:** Recent played tracks use cursor-based pagination (`after`/`before`) instead of offset-based. The Spotify API returns `CursorBasedPagingObject` with `cursors.after` field instead of `offset`.

**Files:**
- Modify: `libs/web/home/data-access/src/lib/store/recent-played-tracks/recent-played-tracks.action.ts`
- Modify: `libs/web/home/data-access/src/lib/store/recent-played-tracks/recent-played-tracks.reducer.ts`
- Modify: `libs/web/home/data-access/src/lib/store/recent-played-tracks/recent-played-tracks.effect.ts`
- Modify: `libs/web/home/data-access/src/lib/store/recent-played-tracks/recent-played-tracks.selector.ts`
- Modify: recent-played component (home/ui/recent-played/)

**Step 1: Update state**

Since this uses cursor-based pagination, use a simplified custom state (not `PaginatedState`):

```typescript
interface RecentPlayedTracksState extends GenericState<SpotifyApi.PlayHistoryObject[]> {
  nextCursor: string | null; // cursors.after value
  total: number;
}
```

**Step 2: Update actions, reducer, effect**

- `loadMoreRecentTracks` action
- Effect calls `getRecentPlayedTracks({ limit: SPOTIFY_DEFAULT_LIMIT, after: nextCursor })`
- Reducer appends items, stores new cursor

**Step 3: Update selector**

Keep the dedup logic from current selector but apply to accumulated items.

**Step 4: Update component**

Add sentinel div.

**Step 5: Build and verify**

**Step 6: Commit**

```bash
git add libs/web/home/
git commit -m "feat(home): add infinite scroll pagination to recent played tracks"
```

---

### Task 13: Final Integration Test and Cleanup

**Step 1: Full build**

Run: `npx nx build angular-spotify --skip-nx-cache`
Expected: Build succeeds with no errors.

**Step 2: Run all tests**

Run: `npx nx run-many --target=test --all --skip-nx-cache`
Expected: All tests pass.

**Step 3: Manual smoke test**

Start the dev server: `npx nx serve angular-spotify`

Test each view:
- [ ] Playlists list: scroll to bottom, see more playlists load
- [ ] Albums list: scroll to bottom, see more albums load
- [ ] Categories: scroll to bottom, see more categories load
- [ ] Featured playlists: scroll to bottom, see more load
- [ ] Saved tracks: scroll to bottom, see more tracks load
- [ ] Search results: search for something, scroll to bottom
- [ ] Category playlists: click a category, scroll to bottom
- [ ] Playlist detail: open a large playlist, scroll to see all tracks
- [ ] Recent played: scroll to see more recent tracks

**Step 4: Verify edge cases**

- [ ] Empty state: no items → no spinner, no sentinel triggers
- [ ] Last page: `next` is null → directive disabled, no more loading
- [ ] Fast scrolling: no duplicate requests (effect filters on `status !== 'loading'`)
- [ ] Navigation: leaving and returning to a page keeps accumulated data

**Step 5: Commit**

```bash
git commit -m "feat: complete infinite scroll pagination across all views"
```
