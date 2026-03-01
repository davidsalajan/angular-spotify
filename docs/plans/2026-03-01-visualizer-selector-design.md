# Visualizer Selector Design

## Problem

The visualizer currently uses a single particle-based visualization with a simplistic audio data calculation (`mean(pitches) / 2`). Users want to choose between different visualization styles, and the audio data driving the visualizer should better represent the music.

## Design Decisions

### 1. Improved Audio Data Calculation

Replace the single `mean(pitches) / 2` value with a richer `AudioData` struct:

```typescript
export interface AudioData {
  energy: number;       // 0-1, normalized from segment loudness_max (-60 to 0 dB)
  pitches: number[];    // 12 pitch classes from current segment (0-1 each)
  timbre: number[];     // 12 timbre coefficients from current segment
  tempo: number;        // BPM from track analysis
  beatPhase: number;    // 0-1, position within current beat cycle
}
```

**Why:** `loudness_max` directly represents perceived intensity. `beatPhase` enables beat-synchronized effects. Raw `pitches` and `timbre` arrays allow visualizers to use specific frequency data rather than a single average.

### 2. Strategy Pattern Architecture

Each visualizer implements a common `VisualizerRenderer` interface:

```typescript
export interface VisualizerRenderer {
  setup(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, audioData: AudioData): void;
  destroy(): void;
}
```

The component holds a single canvas (managed by sketch-js). When the user switches type, the current renderer is destroyed and a new one is initialized on the same canvas.

**Why:** Clean separation of concerns, easy to add more visualizers, minimal changes to existing structure, reuses sketch-js for canvas management.

### 3. Visualizer Types

```typescript
export enum VisualizerType {
  Particles = 'particles',
  WaveformBars = 'waveform-bars'
}
```

#### Particles (Existing)
The current 128-particle visualization, refactored to implement `VisualizerRenderer`. Updated to use `energy` from `AudioData` instead of `mean(pitches) / 2`.

#### Waveform Bars (New)
- 12 vertical bars corresponding to the 12 pitch classes (C through B)
- Bar heights driven by `pitches[]` values, scaled by overall `energy`
- Bars centered horizontally, drawn from bottom up
- Colored using the existing `COLORS` palette with brightness modulated by energy
- Smooth animation via lerp toward target height (smoothing factor ~0.3, similar to particle decay)
- Beat pulse: subtle scale bump on beat transitions using `beatPhase`
- Same canvas composition (`globalCompositeOperation = 'lighter'`) for visual cohesion

### 4. Dropdown UI

A dropdown selector added to the existing action buttons area (top-right corner of visualizer). Styled to match the existing circular button aesthetic (semi-transparent black, hover states).

### 5. State Management

Add `selectedVisualizerType: VisualizerType` to `VisualizerStore` state:
- Default: `VisualizerType.Particles`
- Observable: `visualizerType$`
- Updater: `setVisualizerType(type: VisualizerType)`

### 6. Component Flow

1. User selects from dropdown
2. Store updates `selectedVisualizerType`
3. Component subscribes to `visualizerType$`
4. On change: `currentRenderer.destroy()` → create new renderer → `setup()`
5. The sketch-js `draw()` loop calls the new renderer seamlessly

## Files to Modify

- `libs/web/visualizer/data-access/src/lib/audio-context.ts` - Refactor to strategy pattern, add `VisualizerRenderer` interface
- `libs/web/visualizer/data-access/src/lib/particle.ts` - Adapt to implement `VisualizerRenderer`
- `libs/web/visualizer/data-access/src/lib/const.ts` - Add `VisualizerType` enum
- `libs/web/visualizer/data-access/src/lib/store/visualizer.store.ts` - Add `selectedVisualizerType` state
- `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.ts` - Wire up dropdown, improved audio calc, renderer switching
- `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.html` - Add dropdown UI

## New Files

- `libs/web/visualizer/data-access/src/lib/visualizer-renderer.interface.ts` - `VisualizerRenderer` and `AudioData` interfaces
- `libs/web/visualizer/data-access/src/lib/particles-renderer.ts` - Extracted particle renderer
- `libs/web/visualizer/data-access/src/lib/waveform-bars-renderer.ts` - New waveform bars renderer
