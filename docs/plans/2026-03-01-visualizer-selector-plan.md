# Visualizer Selector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dropdown to select between multiple visualizer types (particles, waveform bars), and improve the audio data calculation to use loudness/beats instead of just mean pitches.

**Architecture:** Strategy pattern with a `VisualizerRenderer` interface. Each visualizer (particles, waveform bars) implements this interface. A single canvas managed by sketch-js renders whichever renderer is active. The `VisualizerStore` tracks selected type. The component computes richer `AudioData` from Spotify analysis and passes it to the active renderer.

**Tech Stack:** Angular, @ngrx/component-store, sketch-js (canvas 2D), Tailwind CSS, lodash-es

---

### Task 1: Add AudioData and VisualizerRenderer interfaces + VisualizerType enum

**Files:**
- Create: `libs/web/visualizer/data-access/src/lib/visualizer-renderer.interface.ts`
- Modify: `libs/web/visualizer/data-access/src/lib/const.ts`
- Modify: `libs/web/visualizer/data-access/src/index.ts`

**Step 1: Create the interfaces file**

Create `libs/web/visualizer/data-access/src/lib/visualizer-renderer.interface.ts`:

```typescript
export interface AudioData {
  energy: number;       // 0-1, normalized from segment loudness_max
  pitches: number[];    // 12 pitch classes from current segment (0-1 each)
  timbre: number[];     // 12 timbre coefficients from current segment
  tempo: number;        // BPM from track analysis
  beatPhase: number;    // 0-1, position within current beat cycle
}

export interface VisualizerRenderer {
  setup(width: number, height: number): void;
  updateAudio(audioData: AudioData): void;
  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  destroy(): void;
}
```

Note: We split `updateAudio` from `draw` because the audio updates at 100ms intervals (from the timer) while `draw` runs at ~60fps from sketch-js. The renderer stores the latest audio data and uses it each frame.

**Step 2: Add VisualizerType enum to const.ts**

Add to the end of `libs/web/visualizer/data-access/src/lib/const.ts`:

```typescript
export enum VisualizerType {
  Particles = 'particles',
  WaveformBars = 'waveform-bars'
}

export const VISUALIZER_TYPE_LABELS: Record<VisualizerType, string> = {
  [VisualizerType.Particles]: 'Particles',
  [VisualizerType.WaveformBars]: 'Waveform Bars'
};
```

**Step 3: Export new interfaces from barrel**

Add to `libs/web/visualizer/data-access/src/index.ts`:

```typescript
export * from './lib/visualizer-renderer.interface';
export * from './lib/const';
```

(Keep the existing exports for `audio-context` and `visualizer.store`.)

**Step 4: Commit**

```bash
git add libs/web/visualizer/data-access/src/lib/visualizer-renderer.interface.ts \
       libs/web/visualizer/data-access/src/lib/const.ts \
       libs/web/visualizer/data-access/src/index.ts
git commit -m "feat(visualizer): add VisualizerRenderer interface, AudioData, and VisualizerType enum"
```

---

### Task 2: Extract ParticlesRenderer from existing code

**Files:**
- Create: `libs/web/visualizer/data-access/src/lib/particles-renderer.ts`
- Reference (read-only): `libs/web/visualizer/data-access/src/lib/particle.ts` (no changes needed)
- Reference (read-only): `libs/web/visualizer/data-access/src/lib/audio-context.ts` (will be modified in Task 4)

**Step 1: Create the ParticlesRenderer**

Create `libs/web/visualizer/data-access/src/lib/particles-renderer.ts`:

```typescript
import { random } from 'lodash-es';
import { NUM_PARTICLES } from './const';
import { Particle } from './particle';
import { AudioData, VisualizerRenderer } from './visualizer-renderer.interface';

export class ParticlesRenderer implements VisualizerRenderer {
  private particles: Particle[] = [];
  private width = 0;
  private height = 0;

  setup(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.particles = [];

    for (let i = 0; i < NUM_PARTICLES; i++) {
      const particle = new Particle(random(width), random(height));
      particle.energy = random(particle.band / 256);
      this.particles.push(particle);
    }
  }

  updateAudio(audioData: AudioData): void {
    for (const particle of this.particles) {
      particle.energy = audioData.energy;
    }
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.width = width;
    this.height = height;
    ctx.globalCompositeOperation = 'lighter';

    for (const particle of this.particles) {
      if (particle.y < -particle.size * particle.level * particle.scale * 2) {
        particle.reset();
        particle.x = random(this.width);
        particle.y = this.height + particle.size * particle.scale * particle.level * 2;
      }

      particle.move();
      particle.draw(ctx);
    }
  }

  destroy(): void {
    this.particles = [];
  }
}
```

This is a direct extraction of the existing logic from `audio-context.ts` `initVisualizer()`. The `setup()` creates particles (previously in sketch's `setup()`), `updateAudio()` replaces the old `analyser.onUpdate` callback, and `draw()` replaces the sketch's `draw()` callback.

**Step 2: Commit**

```bash
git add libs/web/visualizer/data-access/src/lib/particles-renderer.ts
git commit -m "feat(visualizer): extract ParticlesRenderer from existing visualizer code"
```

---

### Task 3: Create WaveformBarsRenderer

**Files:**
- Create: `libs/web/visualizer/data-access/src/lib/waveform-bars-renderer.ts`

**Step 1: Create the WaveformBarsRenderer**

Create `libs/web/visualizer/data-access/src/lib/waveform-bars-renderer.ts`:

```typescript
import { COLORS } from './const';
import { AudioData, VisualizerRenderer } from './visualizer-renderer.interface';

const NUM_BARS = 12;
const BAR_SMOOTHING = 0.3;
const BAR_DECAY = 0.95;
const GLOW_BLUR = 15;
const BAR_GAP_RATIO = 0.3; // gap between bars as ratio of bar width
const MAX_HEIGHT_RATIO = 0.85; // max bar height as ratio of canvas height
const MIN_HEIGHT_RATIO = 0.02; // min bar height to always show something
const REFLECTION_ALPHA = 0.15;
const REFLECTION_HEIGHT_RATIO = 0.3;

export class WaveformBarsRenderer implements VisualizerRenderer {
  private smoothedHeights: number[] = new Array(NUM_BARS).fill(0);
  private decayHeights: number[] = new Array(NUM_BARS).fill(0);
  private currentEnergy = 0;
  private currentBeatPhase = 0;
  private barColors: string[] = [];

  setup(width: number, height: number): void {
    this.smoothedHeights = new Array(NUM_BARS).fill(0);
    this.decayHeights = new Array(NUM_BARS).fill(0);
    this.currentEnergy = 0;
    this.currentBeatPhase = 0;
    // Assign colors from the palette, cycling if needed
    this.barColors = Array.from({ length: NUM_BARS }, (_, i) => COLORS[i % COLORS.length]);
  }

  updateAudio(audioData: AudioData): void {
    this.currentEnergy = audioData.energy;
    this.currentBeatPhase = audioData.beatPhase;

    for (let i = 0; i < NUM_BARS; i++) {
      const pitch = audioData.pitches[i] ?? 0;
      // Target height: pitch value scaled by energy
      const target = pitch * (0.3 + audioData.energy * 0.7);
      this.decayHeights[i] = Math.max(this.decayHeights[i], target);
    }
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.globalCompositeOperation = 'lighter';

    const totalBarSpace = width * 0.8; // use 80% of width
    const startX = (width - totalBarSpace) / 2;
    const barWidth = totalBarSpace / (NUM_BARS * (1 + BAR_GAP_RATIO));
    const gap = barWidth * BAR_GAP_RATIO;
    const baseY = height * 0.85; // bars grow from 85% of height upward

    // Beat pulse - subtle scale bump at beat start
    const beatPulse = 1.0 + Math.max(0, 1.0 - this.currentBeatPhase * 4) * 0.08;

    for (let i = 0; i < NUM_BARS; i++) {
      // Smooth animation
      this.smoothedHeights[i] += (this.decayHeights[i] - this.smoothedHeights[i]) * BAR_SMOOTHING;
      this.decayHeights[i] *= BAR_DECAY;

      const barHeight = Math.max(
        height * MIN_HEIGHT_RATIO,
        this.smoothedHeights[i] * height * MAX_HEIGHT_RATIO * beatPulse
      );

      const x = startX + i * (barWidth + gap);
      const y = baseY - barHeight;

      // Main bar with glow
      ctx.save();
      ctx.shadowColor = this.barColors[i];
      ctx.shadowBlur = GLOW_BLUR * this.currentEnergy;
      ctx.fillStyle = this.barColors[i];
      ctx.globalAlpha = 0.6 + this.currentEnergy * 0.4;

      // Rounded top corners
      const radius = Math.min(barWidth / 2, 4);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, baseY);
      ctx.lineTo(x, baseY);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();

      // Reflection below baseline
      ctx.shadowBlur = 0;
      ctx.globalAlpha = REFLECTION_ALPHA * this.currentEnergy;
      const reflectionHeight = barHeight * REFLECTION_HEIGHT_RATIO;
      ctx.fillRect(x, baseY, barWidth, reflectionHeight);

      ctx.restore();
    }
  }

  destroy(): void {
    this.smoothedHeights = [];
    this.decayHeights = [];
  }
}
```

**Step 2: Commit**

```bash
git add libs/web/visualizer/data-access/src/lib/waveform-bars-renderer.ts
git commit -m "feat(visualizer): add WaveformBarsRenderer with 12 pitch-class bars"
```

---

### Task 4: Refactor initVisualizer to use VisualizerRenderer

**Files:**
- Modify: `libs/web/visualizer/data-access/src/lib/audio-context.ts`
- Modify: `libs/web/visualizer/data-access/src/index.ts`

**Step 1: Rewrite audio-context.ts**

Replace the entire contents of `libs/web/visualizer/data-access/src/lib/audio-context.ts` with:

```typescript
// Audio visualization originally created by Justin Windle (@soulwire)
// as seen on https://codepen.io/soulwire/pen/Dscga
// also seen on https://github.com/koel/core/blob/master/js/utils/visualizer.ts by @phanan

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../typings/sketch-js.d.ts" />

import * as Sketch from 'sketch-js';
import { VisualizerType } from './const';
import { ParticlesRenderer } from './particles-renderer';
import { AudioData, VisualizerRenderer } from './visualizer-renderer.interface';
import { WaveformBarsRenderer } from './waveform-bars-renderer';

export function createRenderer(type: VisualizerType): VisualizerRenderer {
  switch (type) {
    case VisualizerType.WaveformBars:
      return new WaveformBarsRenderer();
    case VisualizerType.Particles:
    default:
      return new ParticlesRenderer();
  }
}

export interface VisualizerInstance {
  sketch: Sketch.Sketch;
  renderer: VisualizerRenderer;
  setRenderer: (type: VisualizerType) => VisualizerRenderer;
  updateAudio: (audioData: AudioData) => void;
}

export const initVisualizer = (
  container: HTMLElement,
  type: VisualizerType = VisualizerType.Particles
): VisualizerInstance => {
  let renderer = createRenderer(type);

  const sketch = Sketch.create({
    container,
    autopause: false,
    setup() {
      renderer.setup(this.width, this.height);
    },
    draw() {
      renderer.draw(this, this.width, this.height);
    }
  });

  const setRenderer = (newType: VisualizerType): VisualizerRenderer => {
    renderer.destroy();
    renderer = createRenderer(newType);
    renderer.setup(sketch.width || container.clientWidth, sketch.height || container.clientHeight);
    return renderer;
  };

  const updateAudio = (audioData: AudioData): void => {
    renderer.updateAudio(audioData);
  };

  return {
    sketch,
    renderer,
    setRenderer,
    updateAudio
  };
};
```

Key changes:
- Removed `AudioAnalyser` class (no longer needed)
- `initVisualizer` now takes a `VisualizerType` and returns a `VisualizerInstance`
- The `VisualizerInstance` exposes `setRenderer()` for switching and `updateAudio()` for feeding audio data
- The sketch's `draw()` delegates to the active renderer
- The sketch's `setup()` delegates to the active renderer

**Step 2: Update barrel export**

Ensure `libs/web/visualizer/data-access/src/index.ts` exports the new files:

```typescript
export * from './lib/audio-context';
export * from './lib/store/visualizer.store';
export * from './lib/visualizer-renderer.interface';
export * from './lib/const';
export * from './lib/particles-renderer';
export * from './lib/waveform-bars-renderer';
```

**Step 3: Commit**

```bash
git add libs/web/visualizer/data-access/src/lib/audio-context.ts \
       libs/web/visualizer/data-access/src/index.ts
git commit -m "refactor(visualizer): rewrite initVisualizer to use VisualizerRenderer strategy pattern"
```

---

### Task 5: Add selectedVisualizerType to VisualizerStore

**Files:**
- Modify: `libs/web/visualizer/data-access/src/lib/store/visualizer.store.ts`

**Step 1: Update the store**

In `libs/web/visualizer/data-access/src/lib/store/visualizer.store.ts`, make these changes:

1. Add import at top:
```typescript
import { VisualizerType } from '../const';
```

2. Add `selectedVisualizerType` to the `VisualizerState` interface:
```typescript
interface VisualizerState {
  isFirstTime: boolean;
  isShownAsPiP: boolean;
  isVisible: boolean;
  selectedVisualizerType: VisualizerType;
}
```

3. Update the initial state in the `super()` call:
```typescript
super({ isVisible: false, isShownAsPiP: false, isFirstTime: true, selectedVisualizerType: VisualizerType.Particles });
```

4. Add a new selector and updater after the existing selectors:
```typescript
readonly visualizerType$ = this.select((s) => s.selectedVisualizerType);

readonly setVisualizerType = this.updater((state, type: VisualizerType) => ({
  ...state,
  selectedVisualizerType: type
}));
```

**Step 2: Commit**

```bash
git add libs/web/visualizer/data-access/src/lib/store/visualizer.store.ts
git commit -m "feat(visualizer): add selectedVisualizerType to VisualizerStore"
```

---

### Task 6: Update PlaybackStore to expose beats and track tempo

**Files:**
- Modify: `libs/web/shared/data-access/store/src/lib/playback/playback.store.ts`

**Step 1: Expand segments$ to include beats and tempo**

In `libs/web/shared/data-access/store/src/lib/playback/playback.store.ts`, update the `segments$` selector (around line 82-86):

Replace:
```typescript
readonly segments$ = this.select((s) => ({
  isPlaying: s.data ? !s.data.paused : false,
  position: s.data?.position,
  segments: s.analysis?.segments
})).pipe(filter((s) => !!s.segments));
```

With:
```typescript
readonly segments$ = this.select((s) => ({
  isPlaying: s.data ? !s.data.paused : false,
  position: s.data?.position,
  segments: s.analysis?.segments,
  beats: s.analysis?.beats,
  tempo: s.analysis?.track?.tempo ?? 120
})).pipe(filter((s) => !!s.segments));
```

**Step 2: Also convert beats from seconds to ms**

In the `loadTracksAnalytics` effect (around line 116-121), after the segments conversion, add beats conversion:

Replace:
```typescript
analysis.segments = analysis.segments.map((segment) => ({
  ...segment,
  start: segment.start * 1000,
  duration: segment.duration * 1000
}));
```

With:
```typescript
analysis.segments = analysis.segments.map((segment) => ({
  ...segment,
  start: segment.start * 1000,
  duration: segment.duration * 1000
}));

if (analysis.beats) {
  analysis.beats = analysis.beats.map((beat) => ({
    ...beat,
    start: beat.start * 1000,
    duration: beat.duration * 1000
  }));
}
```

**Step 3: Commit**

```bash
git add libs/web/shared/data-access/store/src/lib/playback/playback.store.ts
git commit -m "feat(playback): expose beats and tempo in segments$ for visualizer"
```

---

### Task 7: Update WebVisualizerUiComponent with renderer switching and improved audio data

**Files:**
- Modify: `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.ts`

**Step 1: Rewrite the component**

Replace the entire contents of `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.ts`:

```typescript
import { PlaybackStore } from '@angular-spotify/web/shared/data-access/store';
import {
  initVisualizer,
  VisualizerInstance,
  VisualizerStore,
  VisualizerType,
  VISUALIZER_TYPE_LABELS
} from '@angular-spotify/web/visualizer/data-access';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { SpotifyApiAudioAnalysisBeat } from '@angular-spotify/web/shared/data-access/models';
import { timer } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { AudioData } from '@angular-spotify/web/visualizer/data-access';

const INTERVAL = 100;

@UntilDestroy()
@Component({
  selector: 'as-web-visualizer-ui',
  templateUrl: './web-visualizer-ui.component.html',
  styleUrls: ['./web-visualizer-ui.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WebVisualizerUiComponent implements OnInit, OnDestroy {
  isFullscreen = false;
  visualizerInstance!: VisualizerInstance;
  isVisualizerShownAsPiP$ = this.visualizerStore.isShownAsPiP$;
  visualizerType$ = this.visualizerStore.visualizerType$;

  visualizerTypes = Object.values(VisualizerType);
  visualizerTypeLabels = VISUALIZER_TYPE_LABELS;

  @ViewChild('visualizer', { static: true }) visualizer!: ElementRef;

  constructor(
    private playbackStore: PlaybackStore,
    @Inject(DOCUMENT) private readonly document: Document,
    private visualizerStore: VisualizerStore
  ) {}

  ngOnInit(): void {
    this.visualizerInstance = initVisualizer(this.visualizer.nativeElement);
    this.init();
    this.listenToTypeChanges();
  }

  init() {
    this.playbackStore.segments$
      .pipe(
        switchMap((data) =>
          timer(0, INTERVAL).pipe(
            map((num) => ({
              num,
              data
            }))
          )
        ),
        tap(({ num, data }) => {
          const { position, isPlaying, segments, beats, tempo } = data;
          if (!isPlaying) {
            return;
          }
          const currentPos = (position || 0) + num * INTERVAL;
          const segment = segments.find((seg) => seg.start >= currentPos);
          if (segment) {
            const audioData: AudioData = {
              energy: this.normalizeEnergy(segment.loudness_max),
              pitches: segment.pitches || [],
              timbre: segment.timbre || [],
              tempo: tempo || 120,
              beatPhase: this.computeBeatPhase(currentPos, beats)
            };
            this.visualizerInstance.updateAudio(audioData);
          }
        }),
        untilDestroyed(this)
      )
      .subscribe();
  }

  private listenToTypeChanges() {
    this.visualizerType$
      .pipe(
        tap((type) => {
          this.visualizerInstance.setRenderer(type);
        }),
        untilDestroyed(this)
      )
      .subscribe();
  }

  /**
   * Normalize loudness_max from dB (-60 to 0) to 0-1 range.
   */
  private normalizeEnergy(loudnessMax: number): number {
    // loudness_max typically ranges from -60 (silent) to 0 (loud)
    const clamped = Math.max(-60, Math.min(0, loudnessMax));
    return (clamped + 60) / 60;
  }

  /**
   * Compute beat phase (0-1) from current position and beats array.
   */
  private computeBeatPhase(currentPos: number, beats?: SpotifyApiAudioAnalysisBeat[]): number {
    if (!beats || beats.length === 0) {
      return 0;
    }
    // Find the current beat
    let currentBeat: SpotifyApiAudioAnalysisBeat | undefined;
    for (let i = beats.length - 1; i >= 0; i--) {
      if (beats[i].start <= currentPos) {
        currentBeat = beats[i];
        break;
      }
    }
    if (!currentBeat || currentBeat.duration <= 0) {
      return 0;
    }
    const elapsed = currentPos - currentBeat.start;
    return Math.min(1, elapsed / currentBeat.duration);
  }

  onVisualizerTypeChange(type: VisualizerType) {
    this.visualizerStore.setVisualizerType(type);
  }

  toggleFullscreen() {
    if (this.isFullscreen) {
      this.document.exitFullscreen();
    } else {
      (this.visualizer.nativeElement as HTMLElement).requestFullscreen();
    }
    this.isFullscreen = !this.isFullscreen;
  }

  togglePiP() {
    this.visualizerStore.togglePiP();
  }

  close() {
    this.visualizerStore.setVisibility({ isVisible: false });
  }

  ngOnDestroy() {
    this.visualizerInstance.sketch.destroy();
  }
}
```

Key changes from original:
- Replaced `sketch` + `analyser` properties with single `visualizerInstance: VisualizerInstance`
- `init()` now computes full `AudioData` (energy from loudness, beatPhase from beats) instead of just `mean(pitches) / 2`
- Added `listenToTypeChanges()` to react to type selection changes
- Added `normalizeEnergy()` and `computeBeatPhase()` helpers
- Added `onVisualizerTypeChange()` called from template
- Exposed `visualizerTypes` and `visualizerTypeLabels` for the dropdown template

**Step 2: Commit**

```bash
git add libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.ts
git commit -m "feat(visualizer): update component with renderer switching and improved audio data"
```

---

### Task 8: Update template and styles with dropdown selector

**Files:**
- Modify: `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.html`
- Modify: `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.scss`
- Modify: `libs/web/visualizer/ui/src/lib/web-visualizer-ui.module.ts`

**Step 1: Update the template**

Replace the entire contents of `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.html`:

```html
<div class="visualizer-actions-wrapper">
  <select
    class="visualizer-select"
    [ngModel]="visualizerType$ | ngrxPush"
    (ngModelChange)="onVisualizerTypeChange($event)"
  >
    <option *ngFor="let type of visualizerTypes" [ngValue]="type">
      {{ visualizerTypeLabels[type] }}
    </option>
  </select>
  <button
    *ngrxLet="isVisualizerShownAsPiP$ as isShownAsPiP"
    (click)="togglePiP()"
    class="action-btn"
    title="{{ isShownAsPiP ? 'Expand' : 'Shrink' }}"
  >
    <svg-icon [key]="isShownAsPiP ? 'expand' : 'shrink'"></svg-icon>
  </button>
  <button (click)="close()" class="action-btn" title="Close">
    <svg-icon [key]="'times'"></svg-icon>
  </button>
</div>
<div #visualizer id="visualizer" (dblclick)="toggleFullscreen()"></div>
```

**Step 2: Update styles**

Add the `.visualizer-select` style in `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.scss`. Add it inside the `.visualizer-actions-wrapper` block:

```scss
:host {
  overflow: hidden;
}

#visualizer {
  background: url('/assets/images/noise.png');
  overflow: hidden;
}

.visualizer-actions-wrapper {
  @apply absolute p-2 flex items-center;
  right: 0px;
  z-index: 10;

  .visualizer-select {
    @apply ml-2 text-white text-xs px-2 py-1 rounded;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
    outline: none;
    appearance: auto;

    &:hover {
      background: rgba(0, 0, 0, 0.4);
    }

    option {
      background: #282828;
      color: #fff;
    }
  }

  .action-btn {
    @apply ml-2;
    border: none;
    border-radius: 50%;
    @apply bg-black bg-opacity-70 w-8 h-8;
    color: #fff;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    position: relative;
    cursor: pointer;

    &:hover {
      @apply bg-opacity-40;
    }
  }
}
```

**Step 3: Add FormsModule to the module**

Update `libs/web/visualizer/ui/src/lib/web-visualizer-ui.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SvgIconComponent } from '@ngneat/svg-icon';
import { LetDirective, PushPipe } from '@ngrx/component';
import { WebVisualizerUiComponent } from './web-visualizer-ui.component';

@NgModule({
  imports: [CommonModule, FormsModule, SvgIconComponent, LetDirective, PushPipe],
  declarations: [WebVisualizerUiComponent],
  exports: [WebVisualizerUiComponent]
})
export class WebVisualizerUiModule {}
```

**Step 4: Commit**

```bash
git add libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.html \
       libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.scss \
       libs/web/visualizer/ui/src/lib/web-visualizer-ui.module.ts
git commit -m "feat(visualizer): add visualizer type dropdown selector to UI"
```

---

### Task 9: Build verification and smoke test

**Step 1: Run the build**

```bash
npx nx build web --skip-nx-cache
```

Expected: Build succeeds with no errors.

**Step 2: Fix any import issues**

If there are import path issues, check that:
- `@angular-spotify/web/visualizer/data-access` barrel exports all new files
- `@angular-spotify/web/shared/data-access/models` exports `SpotifyApiAudioAnalysisBeat`
- `FormsModule` is imported in the UI module

**Step 3: Run lint**

```bash
npx nx lint web-visualizer-data-access
npx nx lint web-visualizer-ui
```

Expected: No lint errors.

**Step 4: Manual smoke test**

1. Start the app: `npx nx serve web`
2. Play a song in Spotify
3. Open the visualizer
4. Verify the particles visualizer still works (default)
5. Use the dropdown to switch to "Waveform Bars"
6. Verify bars animate with the music
7. Switch back to "Particles" - verify it re-initializes
8. Test PiP mode with both visualizers
9. Test fullscreen with both visualizers

**Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(visualizer): address build and lint issues for visualizer selector"
```
