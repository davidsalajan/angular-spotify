# Infinite Scroll Pagination Design

## Context

The Angular Spotify app currently loads only the first page (offset=0, limit=50) for all endpoints. No pagination or infinite scroll exists. Users see at most 50 items in any list view.

Spotify's API returns `PagingObject<T>` responses with `next`, `offset`, `limit`, `total`, and `items` fields. The `next` field is `null` when there are no more pages.

Example payload:
```json
{
  "href": "https://api.spotify.com/v1/users/1257550989/playlists?offset=0&limit=50&locale=en",
  "limit": 50,
  "next": "https://api.spotify.com/v1/users/1257550989/playlists?offset=50&limit=50&locale=en",
  "offset": 0,
  "previous": null,
  "total": 143,
  "items": []
}
```

## Decisions

- **UX pattern:** Infinite scroll (auto-load on scroll, matching Spotify app behavior)
- **Scope:** All list views — playlists, albums, tracks, featured playlists, categories, category playlists, search results, recent played, playlist tracks, album tracks
- **Implementation:** Custom Angular directive using IntersectionObserver (no third-party library)
- **State management:** Accumulate items in store; each `loadMore` appends to existing array
- **`hasMore`:** Derived via selector (`next !== null`), not stored in state
- **No generic wrapper component** — directive approach keeps things simple; extract later if needed

## Design

### 1. Shared Constant

Extract magic number `50` into a shared constant used by all API services.

```typescript
// libs/web/shared/data-access/spotify-api/src/lib/spotify-api.constant.ts
export const SPOTIFY_DEFAULT_LIMIT = 50;
```

### 2. API Service Fix

`playlist-api.ts` `getTracks()` is the only method missing pagination params. Add `SpotifyApiParams` parameter.

All other API services already accept `SpotifyApiParams` with `limit` and `offset` — they just aren't called with `offset > 0` yet.

### 3. Paginated State Type

Extend existing `GenericState<T>` with pagination metadata.

```typescript
// libs/web/shared/data-access/spotify-api/src/lib/paginated-state.model.ts
export interface PaginatedState<T> extends GenericState<T[]> {
  // data: T[] — accumulated items from all loaded pages
  next: string | null;   // Spotify's next URL; null means no more pages
  total: number;         // total items available from API
  offset: number;        // current offset
  limit: number;         // page size
}
```

### 4. Reducer Utility Functions

Shared helper functions that each feature's reducer calls to DRY up pagination logic.

```typescript
// libs/web/shared/data-access/spotify-api/src/lib/paginated-state.util.ts

function onLoadPage<T>(state: PaginatedState<T>): PaginatedState<T> {
  return { ...state, status: 'loading' };
}

function onLoadPageSuccess<T>(state: PaginatedState<T>, pagingObject: SpotifyApi.PagingObject<T>): PaginatedState<T> {
  return {
    ...state,
    data: [...(state.data || []), ...pagingObject.items],
    next: pagingObject.next,
    total: pagingObject.total,
    offset: pagingObject.offset,
    limit: pagingObject.limit,
    status: 'success',
    error: null,
  };
}

// Selector utility
function selectHasMore<T>(state: PaginatedState<T>): boolean {
  return state.next !== null;
}
```

### 5. Infinite Scroll Directive

Standalone directive using IntersectionObserver.

```typescript
// libs/web/shared/ui/infinite-scroll/
@Directive({ selector: '[asInfiniteScroll]', standalone: true })
export class InfiniteScrollDirective {
  enabled = input(true);
  scrolledToBottom = output<void>();
  // IntersectionObserver on host element
  // Emits when sentinel enters viewport and enabled=true
  // Cleans up on destroy
}
```

### 6. Store Updates (All 8 Stores)

Each store needs:
- **State:** Migrate from `GenericState<Response>` to `PaginatedState<ItemType>`
- **Actions:** Add `loadMore[Feature]` action
- **Effects:** Remove `!state.data` guard; load next page using current offset + limit; respect `hasMore`
- **Reducers:** Use `onLoadPage` / `onLoadPageSuccess` helpers
- **Selectors:** Update to read from flat `data: T[]`; add `selectHasMore`

Affected stores:
| Store | Pattern | Item Type |
|-------|---------|-----------|
| Playlists | Global NgRx | `PlaylistObjectSimplified` |
| Albums | Global NgRx | `SavedAlbumObject` |
| Categories | Global NgRx | `CategoryObject` |
| Featured Playlists | Global NgRx | `PlaylistObjectSimplified` |
| Playlist Detail Tracks | ComponentStore | `PlaylistTrackObject` |
| Album Detail Tracks | ComponentStore | `TrackObjectSimplified` |
| Search | ComponentStore | mixed (tracks, artists, albums, playlists) |
| Saved Tracks | ComponentStore | `SavedTrackObject` |

### 7. Template Updates

Every list view adds the sentinel div with the directive:

```html
<div class="common-grid">
  @for (item of items(); track item) {
    <as-card ... />
  }
</div>
<div
  asInfiniteScroll
  [enabled]="(next$ | async) !== null && !(isLoading$ | async)"
  (scrolledToBottom)="loadMore()"
></div>
@if (isLoading$ | async) {
  <as-spinner />
}
```

### What Stays Unchanged

- Card components, grid layouts, loading spinners
- Route structure
- Detail views still use ComponentStore (just enhanced with pagination)

## Spotify API Constraints

- Max `limit`: 50 for most endpoints
- Max `offset + limit`: 2,000 (max 40 pages of 50 items)
- `next` field is the source of truth for "has more pages"
- Recent tracks use cursor-based pagination (`after`/`before`) — separate handling needed
