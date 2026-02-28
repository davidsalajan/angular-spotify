# Lyrics Feature Design

Synced lyrics display powered by Musixmatch, mirroring the visualizer's architecture pattern (dedicated route + PiP fallback).

## Requirements

- Fetch lyrics from Musixmatch by track name + artist name
- Show synced (timestamped) lyrics with auto-scroll tracking playback position
- Fall back to plain lyrics with manual scroll when synced data unavailable
- Click a synced lyric line to seek playback to that position
- Toggle button in the now-playing bar (next to visualizer toggle)
- Full-screen `/lyrics` route for the main view
- PiP mini-panel when navigating away from `/lyrics`

## Architecture: Mirror Visualizer Pattern

### Library Structure

```
libs/web/lyrics/
  ├── data-access/        LyricsStore, MusixmatchApiService, models
  ├── feature/            LyricsComponent (routed container)
  └── ui/
      ├── lyrics-view/    Full lyrics display (presentational)
      ├── lyrics-pip/     PiP mini-panel (presentational)
      └── lyrics-toggle/  Toggle button for now-playing bar
```

## Data Layer

### Musixmatch API

Direct client-side calls. API key stored in environment config (`AppConfig`).

Two endpoints used:
- `matcher.subtitle.get?q_track=...&q_artist=...` — synced lyrics (timestamped lines)
- `matcher.lyrics.get?q_track=...&q_artist=...` — plain lyrics fallback

Strategy: try synced first, fall back to plain.

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
```

### LyricsStore (ComponentStore)

**Selectors:**
- `lyrics$`, `isSynced$`, `isVisible$`, `isShownAsPiP$`, `status$`
- `showPiPLyrics$` — derived: `isShownAsPiP && isVisible && lyrics exist`
- `activeLine$` — derived from `PlaybackStore.position$` + lyrics timestamps. Finds the last line whose `time <= currentPosition`.

**Effects:**
- `loadLyrics(track)` — triggered by `PlaybackStore.currentTrack$` changes. Checks cache (currentTrackId), fetches synced then plain from Musixmatch.
- PiP route watcher — mirrors `VisualizerStore.showVisualizerAsPiP$` pattern. Sets `isShownAsPiP: true` when navigating away from `/lyrics`.

**Caching:** In-memory via `currentTrackId` in state. Skip fetch if track hasn't changed.

### Environment Config

Add to `AppConfig`:
```typescript
musixmatchApiKey: string;
musixmatchBaseURL: string;  // https://api.musixmatch.com/ws/1.1
```

## UI Components

### Full-screen Lyrics View

- Fills the main content area at `/lyrics` route
- Dark background (app's baseline color)
- Lines rendered vertically, large font (~24-28px bold)
- **Synced mode:** active line bright white/green, past lines dimmed gray. Auto-scrolls to keep active line in upper third. Each line clickable → `PlayerApiService.seek(line.time)`.
- **Unsynced mode:** all lines equal opacity, manual scroll, no click-to-seek.

### Lyrics Toggle (Now-Playing Bar)

Icon button placed next to `<as-visualization-toggle>` in the now-playing bar's right flex container. Tooltip: "Show lyrics". Clicking navigates to `/lyrics` or toggles visibility off.

### PiP Lyrics Panel

- Fixed position, bottom-right (offset from visualizer PiP if both active)
- Compact: shows current line + next line only
- Clickable to navigate back to `/lyrics`
- Rendered in `LayoutComponent` template (same pattern as visualizer PiP)

## Data Flow

```
PlaybackStore.currentTrack$ changes
  → LyricsStore.loadLyrics effect
    → MusixmatchApiService.getSyncedLyrics() || .getPlainLyrics()
    → Parse response into LyricLine[]
    → Update state (lyrics, isSynced, status)

PlaybackStore.position$ (every ~1s)
  → LyricsStore.activeLine$ selector
    → Find line where time <= position
    → LyricsViewComponent auto-scrolls to active line

User clicks lyric line
  → PlayerApiService.seek(line.time)
  → Playback jumps, position$ updates, activeLine$ recalculates
```

## Files Modified (Existing)

- `libs/web/shell/ui/now-playing-bar/` — add `<as-lyrics-toggle>` next to visualization toggle
- `libs/web/shell/ui/layout/` — add PiP lyrics panel (like PiP visualizer)
- `libs/web/shell/feature/.../web-shell.routes.ts` — add `/lyrics` route
- `libs/web/shared/utils/.../router-util.ts` — add `Lyrics` config
- Environment files — add Musixmatch config
- `tsconfig.base.json` — add path aliases for new libs
