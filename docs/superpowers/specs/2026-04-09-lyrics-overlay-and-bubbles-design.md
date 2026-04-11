# Lyrics Overlay on Visualizer + Bubbles Renderer + Scrollable Lyrics PIP

**Date**: 2026-04-09
**Status**: Approved

## Overview

Three related enhancements to the lyrics and visualizer experience:

1. **Lyrics Overlay** — Animated synced lyrics rendered on top of the full-screen visualizer
2. **Bubbles Renderer** — A new 7th visualizer renderer inspired by floating translucent bubbles
3. **Scrollable Lyrics PIP** — Make the existing lyrics PIP card scrollable with all lines visible

## 1. Lyrics Overlay on Visualizer

### Behavior

When **synced lyrics are available** and the **visualizer is full-screen** (at `/visualizer` route), render animated lyrics on a transparent overlay layer on top of the visualizer canvas.

When the overlay is active, the lyrics PIP card is hidden to avoid duplication.

### Animation: Hybrid (Curved Entry + Karaoke Wipe)

**Phase 1 — Curved Entry:**
- Each new lyric line flies in along a Bezier curve path toward the center of the canvas.
- Entry direction is **energy-driven** using audio analysis data from `PlaybackStore.segments$`:
  - Low energy (calm sections) → gentle curves from the sides
  - High energy → dramatic sweeps from corners with longer arc paths
- Entry uses cubic ease-out for natural deceleration.

**Phase 2 — Karaoke Wipe:**
- Once the line settles at center, a highlight glow sweeps word-by-word.
- **Word timing**: LRC format only provides per-line timestamps, not per-word. Estimate word timing by dividing the line's duration (gap between current and next line timestamp) evenly across word count. This is approximate but sufficient for a visual effect.
- Active word: full white with colored glow shadow.
- Past words: dimmed to ~60% opacity.
- Upcoming words: ghosted at ~25% opacity.

**Phase 3 — Exit:**
- When the next lyric line arrives, the current line fades out.
- Next line preview appears ghosted below center shortly before the transition.

### Implementation

- **New component**: `LyricsOverlayComponent`
  - Absolutely-positioned transparent `<div>` layered on top of the visualizer `<canvas>`
  - Text rendered via CSS/HTML (not canvas) for better font rendering, shadows, and accessibility
  - Uses CSS animations/transforms for the Bezier curve entry path
  - Word-by-word highlight via CSS transitions on individual `<span>` elements

- **Data sources**:
  - `LyricsStore.activeLine$` — current lyric line and timing
  - `LyricsStore.lines$` — all lyric lines (for next-line preview)
  - `PlaybackStore.segments$` — audio energy level for curve intensity
  - `PlaybackStore.interpolatedPosition$` — precise playback position for word timing

- **Visibility conditions** (all must be true):
  - Synced lyrics available (`LyricsStore.isSynced$`)
  - Visualizer is full-screen (at `/visualizer` route, not PIP)
  - Lyrics feature is enabled (`LyricsStore.isVisible$`)

- **Placement**: Rendered inside the visualizer feature component's template, positioned absolutely over the canvas.

## 2. Bubbles Visualizer Renderer

### Behavior

A new 7th renderer added to the plugin-based renderer system. Floating translucent circles that drift across the canvas and react to audio data.

### Visuals

- Translucent circles of varying sizes (range: ~8px to ~50px radius)
- Colors drawn from the existing shared `COLORS` palette in `const.ts`
- `globalCompositeOperation: 'lighter'` for glow/bloom effect (consistent with other renderers)
- Gentle drift and float movement as base motion
- Soft edges with radial gradient fills for translucency

### Audio Reactivity

- **Pitch data** (12 values): Controls individual bubble color/hue selection from the palette
- **Energy** (0-1): Scales bubble sizes and spawn rate — higher energy = larger bubbles, more spawning
- **Beat phase** (0-1): Triggers brief size pulse on each beat (bubbles "breathe" with the rhythm)
- **Idle state**: Gentle drift animation with slow size oscillation when audio is silent

### Implementation

- New file: `libs/web/visualizer/data-access/bubbles-renderer.ts`
- Implements `VisualizerRenderer` interface: `setup()`, `updateAudio()`, `draw()`, `destroy()`
- Add `Bubbles` to `VisualizerType` enum in `const.ts`
- Register in `createRenderer()` factory in `audio-context.ts`
- Appears in the renderer selector dropdown in the visualizer UI

### Temporal Smoothing

- Apply same `SMOOTHING` constant (~0.1-0.15) as other renderers for audio data
- Asymmetric smoothing for bubble sizes: fast grow on energy spike, slow shrink on decay

## 3. Scrollable Lyrics PIP

### Behavior

Make the existing `LyricsPipComponent` scrollable so users can see all lyrics, not just the current + next line.

### When It Shows

| Scenario | Display |
|---|---|
| Synced lyrics + visualizer full-screen | Lyrics overlay (PIP hidden) |
| Synced lyrics + no visualizer full-screen | Scrollable PIP card |
| Unsynced lyrics (any context) | Scrollable PIP card |

### Changes to Existing PIP

- Replace 2-line display with a scrollable list of all lyric lines
- Auto-scroll to keep the active line visible and centered in the PIP viewport
- Line styling:
  - Active line: bold, full brightness (white)
  - Past lines: dimmed opacity
  - Upcoming lines: medium opacity
- For synced lyrics: clicking a line seeks to that timestamp (same behavior as full-screen `/lyrics` view)
- PIP card height capped at ~150px with `overflow-y: auto`
- Expand and close buttons remain on hover (existing behavior)

### Implementation

- Modify existing `LyricsPipComponent` template and styles
- Inject full `LyricsStore.lines$` instead of just active + next
- Add auto-scroll logic (smooth scroll to active element)
- Add click-to-seek handler for synced lyrics
- Update `LyricsStore` / layout visibility logic:
  - New selector: `showLyricsOverlay$` = `isSynced$ && visualizerIsFullScreen$`
  - PIP shows when: `isVisible$ && isShownAsPiP$ && !showLyricsOverlay$`

## Data Flow Summary

```
PlaybackStore
  ├── currentTrack$  ──→  LyricsStore (fetch lyrics)
  ├── segments$      ──→  VisualizerStore (audio data for renderers)
  │                  ──→  LyricsOverlayComponent (energy for curve intensity)
  └── interpolatedPosition$
                     ──→  LyricsStore (active line calculation)
                     ──→  LyricsOverlayComponent (word-by-word timing)

LyricsStore
  ├── lines$         ──→  LyricsOverlayComponent (all lines + timing)
  │                  ──→  LyricsPipComponent (scrollable list)
  ├── activeLine$    ──→  LyricsOverlayComponent (current line)
  │                  ──→  LyricsPipComponent (auto-scroll target)
  ├── isSynced$      ──→  Layout (overlay vs PIP decision)
  └── isVisible$     ──→  Layout (show/hide)

VisualizerStore
  ├── isFullScreen$  ──→  Layout (overlay vs PIP decision)
  └── selectedType$  ──→  createRenderer() (includes new Bubbles option)
```

## Files to Create

- `libs/web/visualizer/data-access/bubbles-renderer.ts` — Bubbles renderer
- `libs/web/lyrics/ui/lyrics-overlay/lyrics-overlay.component.ts` — Overlay component
- `libs/web/lyrics/ui/lyrics-overlay/lyrics-overlay.component.html` — Overlay template
- `libs/web/lyrics/ui/lyrics-overlay/lyrics-overlay.component.scss` — Overlay styles + animations

## Files to Modify

- `libs/web/visualizer/data-access/const.ts` — Add `Bubbles` to `VisualizerType` enum
- `libs/web/visualizer/data-access/audio-context.ts` — Register Bubbles in `createRenderer()`
- `libs/web/lyrics/ui/lyrics-pip/` — Refactor to scrollable list with auto-scroll
- `libs/web/lyrics/data-access/lyrics.store.ts` — Add `showLyricsOverlay$` selector
- `libs/web/visualizer/feature/visualizer.component.ts` — Include lyrics overlay in template
- `libs/web/shell/ui/layout/layout.component.ts` — Update PIP visibility condition
- `libs/web/shell/ui/layout/layout.component.scss` — Adjust PIP positioning if needed
