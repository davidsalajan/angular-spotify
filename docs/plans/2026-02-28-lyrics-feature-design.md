# Lyrics Feature Design

Synced lyrics display powered by LRCLIB, mirroring the visualizer's architecture pattern (dedicated route + PiP fallback).

> **Note:** Originally planned with Musixmatch, but Musixmatch no longer accepts new developer signups. Switched to [LRCLIB](https://lrclib.net) — a free, open lyrics API that requires no API key and provides both synced (LRC format) and plain lyrics.

## Requirements

- Fetch lyrics from LRCLIB by track name + artist name
- Show synced (timestamped) lyrics with auto-scroll tracking playback position
- Fall back to plain lyrics with manual scroll when synced data unavailable
- Click a synced lyric line to seek playback to that position
- Toggle button in the now-playing bar (next to visualizer toggle)
- Full-screen `/lyrics` route for the main view
- Reset toggle state on navigation away from `/lyrics`

## Architecture: Mirror Visualizer Pattern

### Library Structure

```
libs/web/lyrics/
  ├── data-access/        LyricsStore, LrclibApiService, models
  ├── feature/            LyricsComponent (routed container)
  └── ui/
      ├── lyrics-view/    Full lyrics display (presentational)
      ├── lyrics-pip/     PiP mini-panel (presentational)
      └── lyrics-toggle/  Toggle button for now-playing bar
```

## Data Layer

### LRCLIB API

Direct client-side calls. No API key required.

Single endpoint:
- `GET https://lrclib.net/api/get?track_name=...&artist_name=...`
- Returns `{ syncedLyrics: string | null, plainLyrics: string | null, ... }`
- `syncedLyrics` is in LRC format: `[mm:ss.xx] lyric text`
- Returns HTTP 404 when track not found

Strategy: prefer `syncedLyrics` (parsed from LRC), fall back to `plainLyrics`.

**CORS note:** Both the auth interceptor and unauthorized interceptor must skip `lrclib.net` requests — the auth interceptor to avoid sending the Spotify `Authorization` header (which LRCLIB's CORS policy rejects), and the unauthorized interceptor to allow 404 errors to propagate normally (its `of(err)` pattern swallows errors that Angular's HttpClient then silently filters out).

### LyricLine Model

```typescript
interface LyricLine {
  time: number | null;  // milliseconds, null for unsynced
  text: string;
}

interface LyricsState {
  lyrics: LyricLine[] | null;
  isSynced: boolean;
  isVisible: boolean;
  isShownAsPiP: boolean;
  isFirstTime: boolean;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  currentTrackId: string | null;
}

interface LrclibResponse {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}
```

### LyricsStore (ComponentStore)

**Selectors:**
- `lyrics$`, `isSynced$`, `isVisible$`, `isShownAsPiP$`, `status$`
- `showPiPLyrics$` — derived: `isShownAsPiP && isVisible && lyrics exist`
- `activeLine$` — derived from interpolated position + lyrics timestamps. Finds the last line whose `time <= currentPosition`.

**Position interpolation:** The Spotify Web Playback SDK only reports position on state changes (seek, pause, play), not continuously. To keep lyrics in sync during playback, `activeLine$` uses an interpolated position stream that:
1. Takes the last known position and SDK event timestamp from `PlaybackStore`
2. Ticks every 100ms, estimating `position + (Date.now() - stateTimestamp)`
3. The `stateTimestamp` is captured in `PlaybackService` at the moment the SDK fires `player_state_changed`, **before** the async `getVolume()` call — this prevents 3-4 second drift caused by the await delay.

**Effects:**
- `watchTrackChanges$` — triggered by `PlaybackStore.currentTrack$` changes. Checks cache (currentTrackId), fetches from LRCLIB.
- `showLyricsAsPiP$` — route watcher. Resets `isVisible` and `isShownAsPiP` when navigating away from `/lyrics`.

**Caching:** In-memory via `currentTrackId` in state. Skip fetch if track hasn't changed.

## UI Components

### Full-screen Lyrics View

- Fills the main content area at `/lyrics` route
- Dark background (app's baseline color)
- Lines rendered vertically, large font (text-3xl bold)
- **Synced mode:** active line bright white, past lines heavily dimmed. Auto-scrolls (deferred via `setTimeout` for OnPush compatibility). Each line clickable → `PlayerApiService.seek(line.time)`.
- **Unsynced mode:** all lines equal opacity, manual scroll, no click-to-seek.
- Color-only transitions (no scale changes) to keep layout stable.

### Lyrics Toggle (Now-Playing Bar)

Icon button placed next to `<as-visualization-toggle>` in the now-playing bar's right flex container. Tooltip: "Show lyrics". Clicking navigates to `/lyrics` or toggles visibility off. State resets on any navigation away from `/lyrics`.

### Status Handling

- `idle` / `loading` → show spinner
- `error` (404 / no lyrics) → show "No lyrics available for this track"
- `loaded` → show lyrics view

## Data Flow

```
PlaybackStore.currentTrack$ changes
  → LyricsStore.watchTrackChanges$ effect
    → LrclibApiService.getLyrics()
    → Parse syncedLyrics (LRC) or plainLyrics into LyricLine[]
    → Update state (lyrics, isSynced, status)

PlaybackStore.positionWithTimestamp$ + interval(100ms)
  → LyricsStore.interpolatedPosition$
    → LyricsStore.activeLine$ selector
      → Find line where time <= interpolated position
      → LyricsViewComponent auto-scrolls to active line

User clicks lyric line
  → PlayerApiService.seek(line.time)
  → Playback jumps, position$ updates, activeLine$ recalculates
```

## Files Modified (Existing)

- `libs/web/shell/ui/now-playing-bar/` — add `<as-lyrics-toggle>` next to visualization toggle
- `libs/web/shell/feature/.../web-shell.routes.ts` — add `/lyrics` route
- `libs/web/shared/utils/.../router-util.ts` — add `Lyrics` config
- `libs/web/auth/util/.../auth.interceptor.ts` — skip `lrclib.net` requests
- `libs/web/auth/util/.../unauthorized.interceptor.ts` — skip `lrclib.net` requests
- `libs/web/shared/data-access/store/.../playback.store.ts` — add `positionWithTimestamp$`, `stateTimestamp`
- `libs/web/shared/data-access/store/.../playback.service.ts` — capture `stateTimestamp` before async getVolume
- `tsconfig.base.json` — add path aliases for new libs
