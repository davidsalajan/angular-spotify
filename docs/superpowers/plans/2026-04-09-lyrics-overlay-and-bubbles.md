# Lyrics Overlay + Bubbles Renderer + Scrollable PIP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overlay animated synced lyrics on the full-screen visualizer with curved entry + karaoke wipe, add a Bubbles renderer, and make the lyrics PIP scrollable.

**Architecture:** Three independent features sharing `LyricsStore` and `VisualizerStore`. The Bubbles renderer plugs into the existing `VisualizerRenderer` interface. The lyrics overlay is a new Angular component layered via CSS on top of the visualizer canvas. The PIP refactor modifies the existing `LyricsPipComponent` in-place. A new `showLyricsOverlay$` selector coordinates visibility between overlay and PIP.

**Tech Stack:** Angular 15+, NgRx ComponentStore, Canvas 2D API, CSS animations/transforms, RxJS

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `libs/web/visualizer/data-access/src/lib/bubbles-renderer.ts` | Bubbles renderer implementing `VisualizerRenderer` |
| `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.component.ts` | Lyrics overlay Angular component |
| `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.component.html` | Overlay template with animated word spans |
| `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.component.scss` | Bezier curve animations + karaoke wipe styles |
| `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.module.ts` | NgModule for overlay component |
| `libs/web/lyrics/ui/lyrics-overlay/src/index.ts` | Public API barrel export |
| `libs/web/lyrics/ui/lyrics-overlay/project.json` | Nx project config |
| `libs/web/lyrics/ui/lyrics-overlay/tsconfig.json` | TypeScript config |
| `libs/web/lyrics/ui/lyrics-overlay/tsconfig.lib.json` | Library TS config |
| `libs/web/lyrics/ui/lyrics-overlay/src/test-setup.ts` | Jest test setup |

### Modified Files

| File | What Changes |
|------|-------------|
| `libs/web/visualizer/data-access/src/lib/const.ts` | Add `Bubbles` to `VisualizerType` enum and labels |
| `libs/web/visualizer/data-access/src/lib/audio-context.ts` | Register `BubblesRenderer` in `createRenderer()` |
| `libs/web/visualizer/data-access/src/index.ts` | Export `BubblesRenderer` |
| `libs/web/lyrics/data-access/src/lib/lyrics.store.ts` | Add `showLyricsOverlay$` selector, expose `interpolatedPosition$` |
| `libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.ts` | Add scrollable list, auto-scroll, click-to-seek |
| `libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.html` | Replace 2-line display with scrollable list |
| `libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.scss` | Add scroll container styles, active line highlighting |
| `libs/web/visualizer/feature/src/lib/visualizer.component.html` | Add lyrics overlay component |
| `libs/web/visualizer/feature/src/lib/visualizer.module.ts` | Import `LyricsOverlayModule` |
| `libs/web/shell/ui/layout/src/lib/layout.component.ts` | Wire `showLyricsOverlay$` to suppress PIP |
| `libs/web/shell/ui/layout/src/lib/layout.component.html` | Update PIP visibility condition |
| `tsconfig.base.json` | Add path mapping for `@angular-spotify/web/lyrics/ui/lyrics-overlay` |

---

## Task 1: Add Bubbles to VisualizerType Enum

**Files:**
- Modify: `libs/web/visualizer/data-access/src/lib/const.ts:30-46`

- [ ] **Step 1: Add `Bubbles` to the `VisualizerType` enum and labels**

In `libs/web/visualizer/data-access/src/lib/const.ts`, add the new enum value and label:

```typescript
export enum VisualizerType {
  Particles = 'particles',
  WaveformBars = 'waveform-bars',
  CircularRing = 'circular-ring',
  RadialSpikes = 'radial-spikes',
  SoundLines = 'sound-lines',
  Lissajous = 'lissajous',
  Bubbles = 'bubbles'
}

export const VISUALIZER_TYPE_LABELS: Record<VisualizerType, string> = {
  [VisualizerType.Particles]: 'Particles',
  [VisualizerType.WaveformBars]: 'Waveform Bars',
  [VisualizerType.CircularRing]: 'Circular Ring',
  [VisualizerType.RadialSpikes]: 'Radial Spikes',
  [VisualizerType.SoundLines]: 'Sound Lines',
  [VisualizerType.Lissajous]: 'Lissajous',
  [VisualizerType.Bubbles]: 'Bubbles'
};
```

- [ ] **Step 2: Commit**

```bash
git add libs/web/visualizer/data-access/src/lib/const.ts
git commit -m "feat(visualizer): add Bubbles to VisualizerType enum"
```

---

## Task 2: Implement BubblesRenderer

**Files:**
- Create: `libs/web/visualizer/data-access/src/lib/bubbles-renderer.ts`
- Modify: `libs/web/visualizer/data-access/src/lib/audio-context.ts:1-34`
- Modify: `libs/web/visualizer/data-access/src/index.ts`

- [ ] **Step 1: Create `bubbles-renderer.ts`**

Create `libs/web/visualizer/data-access/src/lib/bubbles-renderer.ts`:

```typescript
import { COLORS, TWO_PI } from './const';
import { AudioData, VisualizerRenderer } from './visualizer-renderer.interface';

const NUM_BUBBLES = 40;
const SMOOTHING = 0.12;
const MIN_RADIUS = 8;
const MAX_RADIUS = 50;
const DRIFT_SPEED = 0.3;

interface Bubble {
  x: number;
  y: number;
  baseRadius: number;
  radius: number;
  targetRadius: number;
  vx: number;
  vy: number;
  color: string;
  phase: number;
}

export class BubblesRenderer implements VisualizerRenderer {
  private bubbles: Bubble[] = [];
  private width = 0;
  private height = 0;
  private currentEnergy = 0;
  private currentBeatPhase = 0;
  private currentPitches: number[] = new Array(12).fill(0);
  private time = 0;

  setup(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.time = 0;
    this.currentEnergy = 0;
    this.currentBeatPhase = 0;
    this.currentPitches = new Array(12).fill(0);
    this.bubbles = [];

    for (let i = 0; i < NUM_BUBBLES; i++) {
      this.bubbles.push(this.createBubble(
        Math.random() * width,
        Math.random() * height
      ));
    }
  }

  private createBubble(x: number, y: number): Bubble {
    const baseRadius = MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS) * 0.5;
    return {
      x,
      y,
      baseRadius,
      radius: baseRadius,
      targetRadius: baseRadius,
      vx: (Math.random() - 0.5) * DRIFT_SPEED,
      vy: (Math.random() - 0.5) * DRIFT_SPEED - 0.2, // slight upward bias
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      phase: Math.random() * TWO_PI
    };
  }

  updateAudio(audioData: AudioData): void {
    // Smooth energy interpolation
    this.currentEnergy += (audioData.energy - this.currentEnergy) * SMOOTHING;
    this.currentBeatPhase = audioData.beatPhase;

    for (let i = 0; i < 12; i++) {
      this.currentPitches[i] += ((audioData.pitches[i] ?? 0) - this.currentPitches[i]) * SMOOTHING;
    }

    // Update bubble target radii based on energy
    for (let i = 0; i < this.bubbles.length; i++) {
      const bubble = this.bubbles[i];
      const pitchIdx = i % 12;
      const pitchInfluence = this.currentPitches[pitchIdx];
      bubble.targetRadius = bubble.baseRadius * (0.5 + this.currentEnergy * 1.5 + pitchInfluence * 0.5);
      bubble.color = COLORS[(Math.floor(pitchIdx + this.currentEnergy * 5)) % COLORS.length];
    }
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.time += 0.02;

    ctx.globalCompositeOperation = 'lighter';

    // Beat pulse: brief size bump at beat start
    const beatPulse = 1.0 + Math.max(0, 1.0 - this.currentBeatPhase * 4) * 0.15;

    for (const bubble of this.bubbles) {
      // Asymmetric radius smoothing: fast grow, slow shrink
      const radiusDiff = bubble.targetRadius * beatPulse - bubble.radius;
      const radiusSpeed = radiusDiff > 0 ? 0.2 : 0.08;
      bubble.radius += radiusDiff * radiusSpeed;

      // Idle breathing oscillation
      const breath = 1 + Math.sin(this.time * 1.5 + bubble.phase) * 0.08;
      const drawRadius = bubble.radius * breath;

      // Drift movement
      bubble.x += bubble.vx + Math.sin(this.time + bubble.phase) * 0.3;
      bubble.y += bubble.vy + Math.cos(this.time * 0.7 + bubble.phase) * 0.2;

      // Wrap around edges
      if (bubble.x < -drawRadius) bubble.x = this.width + drawRadius;
      if (bubble.x > this.width + drawRadius) bubble.x = -drawRadius;
      if (bubble.y < -drawRadius) bubble.y = this.height + drawRadius;
      if (bubble.y > this.height + drawRadius) bubble.y = -drawRadius;

      // Draw bubble with radial gradient for translucency
      ctx.save();
      const gradient = ctx.createRadialGradient(
        bubble.x, bubble.y, 0,
        bubble.x, bubble.y, drawRadius
      );
      gradient.addColorStop(0, bubble.color + 'AA'); // semi-transparent center
      gradient.addColorStop(0.6, bubble.color + '44');
      gradient.addColorStop(1, bubble.color + '00'); // fully transparent edge

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, drawRadius, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }
  }

  destroy(): void {
    this.bubbles = [];
  }
}
```

- [ ] **Step 2: Register in `createRenderer()` factory**

In `libs/web/visualizer/data-access/src/lib/audio-context.ts`, add the import and case:

```typescript
import { BubblesRenderer } from './bubbles-renderer';
```

Add above the `default` case in the switch statement:

```typescript
    case VisualizerType.Bubbles:
      return new BubblesRenderer();
```

The full switch becomes:

```typescript
export function createRenderer(type: VisualizerType): VisualizerRenderer {
  switch (type) {
    case VisualizerType.WaveformBars:
      return new WaveformBarsRenderer();
    case VisualizerType.CircularRing:
      return new CircularRingRenderer();
    case VisualizerType.Lissajous:
      return new LissajousRenderer();
    case VisualizerType.RadialSpikes:
      return new RadialSpikesRenderer();
    case VisualizerType.SoundLines:
      return new SoundLinesRenderer();
    case VisualizerType.Bubbles:
      return new BubblesRenderer();
    case VisualizerType.Particles:
    default:
      return new ParticlesRenderer();
  }
}
```

- [ ] **Step 3: Export from barrel**

Add to `libs/web/visualizer/data-access/src/index.ts`:

```typescript
export * from './lib/bubbles-renderer';
```

- [ ] **Step 4: Verify the renderer appears in the dropdown**

Run the app and navigate to `/visualizer`. The "Bubbles" option should appear in the renderer selector dropdown. Select it and verify translucent circles render on the canvas.

Run: `npx nx serve angular-spotify`

- [ ] **Step 5: Commit**

```bash
git add libs/web/visualizer/data-access/src/lib/bubbles-renderer.ts libs/web/visualizer/data-access/src/lib/audio-context.ts libs/web/visualizer/data-access/src/index.ts
git commit -m "feat(visualizer): add Bubbles renderer with translucent floating circles"
```

---

## Task 3: Make Lyrics PIP Scrollable

**Files:**
- Modify: `libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.ts`
- Modify: `libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.html`
- Modify: `libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.scss`

- [ ] **Step 1: Update the component class**

Replace the contents of `libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.ts`:

```typescript
import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  QueryList,
  ViewChildren
} from '@angular/core';
import { LyricLine } from '@angular-spotify/web/lyrics/data-access';

@Component({
  selector: 'as-lyrics-pip',
  templateUrl: './lyrics-pip.component.html',
  styleUrls: ['./lyrics-pip.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LyricsPipComponent implements AfterViewChecked {
  @Input() lyrics: LyricLine[] | null = null;
  @Input() activeLine = -1;
  @Input() isSynced = false;
  @Output() expand = new EventEmitter<void>();
  @Output() closePip = new EventEmitter<void>();
  @Output() seekTo = new EventEmitter<number>();

  @ViewChildren('lyricLine') lyricLineElements!: QueryList<ElementRef>;

  private lastScrolledLine = -1;

  ngAfterViewChecked(): void {
    if (this.activeLine >= 0 && this.activeLine !== this.lastScrolledLine) {
      this.scrollToActiveLine();
      this.lastScrolledLine = this.activeLine;
    }
  }

  onLineClick(line: LyricLine): void {
    if (this.isSynced && line.time !== null) {
      this.seekTo.emit(line.time);
    }
  }

  private scrollToActiveLine(): void {
    const elements = this.lyricLineElements?.toArray();
    const activeEl = elements?.[this.activeLine]?.nativeElement as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}
```

- [ ] **Step 2: Update the template**

Replace the contents of `libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.html`:

```html
<div class="lyrics-pip">
  <div class="actions">
    <button (click)="expand.emit()" class="action-btn" title="Expand">
      <svg-icon [key]="'expand'"></svg-icon>
    </button>
    <button (click)="closePip.emit()" class="action-btn" title="Close">
      <svg-icon [key]="'times'"></svg-icon>
    </button>
  </div>
  <div class="lyrics-scroll-container">
    <p
      *ngFor="let line of lyrics; let i = index"
      #lyricLine
      class="lyric-line"
      [class.active]="i === activeLine"
      [class.past]="isSynced && activeLine >= 0 && i < activeLine"
      [class.upcoming]="isSynced && (activeLine < 0 || i > activeLine)"
      [class.synced]="isSynced && line.time !== null"
      (click)="onLineClick(line)"
    >
      {{ line.text }}
    </p>
  </div>
</div>
```

- [ ] **Step 3: Update the styles**

Replace the contents of `libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.scss`:

```scss
.lyrics-pip {
  @apply p-4 rounded relative;
  background: rgba(var(--background-highlight), 0.95);
  backdrop-filter: blur(8px);
  min-width: 300px;
  max-width: 300px;

  &:hover {
    background: rgba(var(--background-highlight), 1);

    .actions {
      opacity: 1;
    }
  }
}

.actions {
  @apply absolute p-1;
  top: 0;
  right: 0;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 1;

  .action-btn {
    @apply ml-1;
    border: none;
    border-radius: 50%;
    @apply bg-black bg-opacity-70 w-7 h-7;
    color: #fff;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;

    &:hover {
      @apply bg-opacity-40;
    }
  }
}

.lyrics-scroll-container {
  max-height: 150px;
  overflow-y: auto;
  scroll-behavior: smooth;

  // Hide scrollbar but keep functionality
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
}

.lyric-line {
  @apply text-sm py-0.5;
  color: rgba(var(--text-baseline), 0.4);
  transition: color 0.3s ease, font-weight 0.3s ease;
  line-height: 1.5;

  &.active {
    @apply text-base font-bold;
    color: rgb(var(--text-baseline));
  }

  &.past {
    color: rgba(var(--text-baseline), 0.3);
  }

  &.upcoming {
    color: rgba(var(--text-baseline), 0.5);
  }

  &.synced {
    cursor: pointer;

    &:hover {
      color: rgba(var(--text-baseline), 0.8);
    }
  }
}
```

- [ ] **Step 4: Verify scrollable PIP works**

Run the app, play a track with lyrics, and verify:
1. PIP shows all lyrics in a scrollable container
2. Active line is bold and auto-scrolled into view
3. Clicking a line on synced lyrics seeks playback

Run: `npx nx serve angular-spotify`

- [ ] **Step 5: Commit**

```bash
git add libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.ts libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.html libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.scss
git commit -m "feat(lyrics): make PIP scrollable with auto-scroll and click-to-seek"
```

---

## Task 4: Add `showLyricsOverlay$` Selector and Expose `interpolatedPosition$`

**Files:**
- Modify: `libs/web/lyrics/data-access/src/lib/lyrics.store.ts:31-52`

- [ ] **Step 1: Inject `VisualizerStore` and add `showLyricsOverlay$` selector**

In `libs/web/lyrics/data-access/src/lib/lyrics.store.ts`:

Add the imports (note: `map` should already be imported, `VisualizerStore` is new):

```typescript
import { VisualizerStore } from '@angular-spotify/web/visualizer/data-access';
```

Ensure `map` is in the existing `rxjs/operators` import (it already is in the current file).

Update the constructor to inject `VisualizerStore`:

```typescript
  constructor(
    private router: Router,
    private location: Location,
    private playbackStore: PlaybackStore,
    private lrclibApi: LrclibApiService,
    private visualizerStore: VisualizerStore
  ) {
    super(initialState);
    this.showLyricsAsPiP$();
    this.watchTrackChanges$();
  }
```

Make `interpolatedPosition$` public (change `private` to `readonly`):

```typescript
  readonly interpolatedPosition$: Observable<number> = combineLatest([
```

Add the `showLyricsOverlay$` selector after the existing `showPiPLyrics$` selector (line ~52):

```typescript
  // Lyrics overlay shows when: synced + lyrics visible + visualizer is full-screen (not PIP)
  readonly isVisualizerFullScreen$: Observable<boolean> = combineLatest([
    this.visualizerStore.isVisible$,
    this.visualizerStore.isShownAsPiP$
  ]).pipe(
    map(([isVisible, isShownAsPiP]) => isVisible && !isShownAsPiP)
  );

  readonly showLyricsOverlay$: Observable<boolean> = combineLatest([
    this.isSynced$,
    this.isVisible$,
    this.lyrics$,
    this.isVisualizerFullScreen$
  ]).pipe(
    map(([isSynced, isVisible, lyrics, vizFullScreen]) =>
      isSynced && isVisible && lyrics !== null && lyrics.length > 0 && vizFullScreen
    )
  );
```

Update `showPiPLyrics$` to exclude when overlay is active:

```typescript
  readonly showPiPLyrics$ = this.select(
    (s) => s.isVisible && s.isShownAsPiP && s.lyrics !== null && s.lyrics.length > 0
  );
```

Note: `showPiPLyrics$` already excludes overlay cases because it requires `isShownAsPiP === true`, while the overlay requires the visualizer to be full-screen (which means lyrics would NOT be in PIP mode since the user navigated to `/visualizer`). However, we need to handle the case where lyrics are visible + visualizer is full-screen but lyrics are NOT shown as PIP. The layout component will use `showLyricsOverlay$` to suppress PIP in that case. We'll handle this in Task 7.

- [ ] **Step 2: Commit**

```bash
git add libs/web/lyrics/data-access/src/lib/lyrics.store.ts
git commit -m "feat(lyrics): add showLyricsOverlay$ selector and expose interpolatedPosition$"
```

---

## Task 5: Create Lyrics Overlay Nx Library Scaffold

**Files:**
- Create: `libs/web/lyrics/ui/lyrics-overlay/project.json`
- Create: `libs/web/lyrics/ui/lyrics-overlay/tsconfig.json`
- Create: `libs/web/lyrics/ui/lyrics-overlay/tsconfig.lib.json`
- Create: `libs/web/lyrics/ui/lyrics-overlay/src/test-setup.ts`
- Create: `libs/web/lyrics/ui/lyrics-overlay/src/index.ts`
- Create: `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.module.ts`
- Modify: `tsconfig.base.json:61-65`

- [ ] **Step 1: Create `project.json`**

Create `libs/web/lyrics/ui/lyrics-overlay/project.json`:

```json
{
  "name": "web-lyrics-ui-lyrics-overlay",
  "$schema": "../../../../../node_modules/nx/schemas/project-schema.json",
  "projectType": "library",
  "sourceRoot": "libs/web/lyrics/ui/lyrics-overlay/src",
  "prefix": "as",
  "targets": {
    "lint": {
      "executor": "@nx/eslint:lint"
    }
  },
  "tags": ["type:ui", "scope:web"]
}
```

- [ ] **Step 2: Create TypeScript configs**

Create `libs/web/lyrics/ui/lyrics-overlay/tsconfig.json`:

```json
{
  "extends": "../../../../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [
    {
      "path": "./tsconfig.lib.json"
    }
  ],
  "compilerOptions": {
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "target": "es2020"
  },
  "angularCompilerOptions": {
    "strictInjectionParameters": true,
    "strictTemplates": true
  }
}
```

Create `libs/web/lyrics/ui/lyrics-overlay/tsconfig.lib.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../../../dist/out-tsc",
    "target": "es2015",
    "declaration": true,
    "declarationMap": true,
    "inlineSources": true,
    "types": [],
    "lib": ["dom", "es2018"]
  },
  "angularCompilerOptions": {
    "skipTemplateCodegen": true,
    "strictMetadataEmit": true,
    "enableResourceInlining": true
  },
  "exclude": ["src/test-setup.ts", "**/*.spec.ts", "**/*.test.ts", "jest.config.ts"],
  "include": ["**/*.ts"]
}
```

- [ ] **Step 3: Create `test-setup.ts` and barrel export**

Create `libs/web/lyrics/ui/lyrics-overlay/src/test-setup.ts`:

```typescript
import 'jest-preset-angular/setup-jest';
```

Create `libs/web/lyrics/ui/lyrics-overlay/src/index.ts`:

```typescript
export * from './lib/lyrics-overlay.module';
```

- [ ] **Step 4: Create the NgModule (empty for now)**

Create `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

@NgModule({
  imports: [CommonModule],
  declarations: [],
  exports: []
})
export class LyricsOverlayModule {}
```

- [ ] **Step 5: Add path mapping to `tsconfig.base.json`**

In `tsconfig.base.json`, add after the `lyrics-view` entry (around line 65):

```json
      "@angular-spotify/web/lyrics/ui/lyrics-overlay": [
        "libs/web/lyrics/ui/lyrics-overlay/src/index.ts"
      ],
```

- [ ] **Step 6: Commit**

```bash
git add libs/web/lyrics/ui/lyrics-overlay/ tsconfig.base.json
git commit -m "chore: scaffold lyrics-overlay Nx library"
```

---

## Task 6: Implement Lyrics Overlay Component

**Files:**
- Create: `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.component.ts`
- Create: `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.component.html`
- Create: `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.component.scss`
- Modify: `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.module.ts`
- Modify: `libs/web/lyrics/ui/lyrics-overlay/src/index.ts`

- [ ] **Step 1: Create the overlay component class**

Create `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { LyricsStore, LyricLine } from '@angular-spotify/web/lyrics/data-access';
import { PlaybackStore } from '@angular-spotify/web/shared/data-access/store';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

interface WordTiming {
  text: string;
  startProgress: number; // 0-1 within the line's duration
  endProgress: number;
}

interface AnimatedLine {
  words: WordTiming[];
  entryOrigin: CurveOrigin;
  progress: number; // 0-1 overall line progress
}

interface CurveOrigin {
  startX: string; // CSS value, e.g., '-120px' or 'calc(100% + 120px)'
  startY: string;
  controlX1: string;
  controlY1: string;
}

// Predefined entry origins for semi-random energy-driven selection
const CALM_ORIGINS: CurveOrigin[] = [
  { startX: '-120px', startY: '40%', controlX1: '10%', controlY1: '35%' },
  { startX: 'calc(100% + 120px)', startY: '60%', controlX1: '90%', controlY1: '55%' },
  { startX: '-100px', startY: '55%', controlX1: '15%', controlY1: '50%' },
  { startX: 'calc(100% + 100px)', startY: '45%', controlX1: '85%', controlY1: '48%' }
];

const INTENSE_ORIGINS: CurveOrigin[] = [
  { startX: '-150px', startY: '10%', controlX1: '5%', controlY1: '5%' },
  { startX: 'calc(100% + 150px)', startY: '90%', controlX1: '95%', controlY1: '95%' },
  { startX: 'calc(100% + 130px)', startY: '5%', controlX1: '90%', controlY1: '10%' },
  { startX: '-130px', startY: '85%', controlX1: '10%', controlY1: '90%' },
  { startX: '50%', startY: '-80px', controlX1: '45%', controlY1: '5%' },
  { startX: '50%', startY: 'calc(100% + 80px)', controlX1: '55%', controlY1: '95%' }
];

@UntilDestroy()
@Component({
  selector: 'as-lyrics-overlay',
  templateUrl: './lyrics-overlay.component.html',
  styleUrls: ['./lyrics-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LyricsOverlayComponent implements OnInit {
  currentLine$!: Observable<AnimatedLine | null>;
  nextLineText$!: Observable<string>;
  wordProgress$!: Observable<number>;

  private lineCounter = 0;

  constructor(
    private lyricsStore: LyricsStore,
    private playbackStore: PlaybackStore
  ) {}

  ngOnInit(): void {
    // Current animated line: emits when active line index changes
    this.currentLine$ = combineLatest([
      this.lyricsStore.lyrics$,
      this.lyricsStore.activeLine$,
      this.playbackStore.segments$.pipe(map((s) => s.segments))
    ]).pipe(
      map(([lyrics, activeIdx, segments]) => {
        if (!lyrics || activeIdx < 0) return null;
        const line = lyrics[activeIdx];
        if (!line || line.time === null) return null;

        const nextLine = lyrics[activeIdx + 1];
        const lineDuration = nextLine?.time !== null && nextLine?.time !== undefined
          ? nextLine.time - line.time
          : 4000; // default 4s if no next line

        const words = this.buildWordTimings(line.text, lineDuration);
        const energy = this.estimateEnergy(line.time, segments);
        const origin = this.pickOrigin(energy);

        return { words, entryOrigin: origin, progress: 0 };
      }),
      distinctUntilChanged((a, b) => {
        if (a === null && b === null) return true;
        if (a === null || b === null) return false;
        return a.words.map((w) => w.text).join(' ') === b.words.map((w) => w.text).join(' ');
      })
    );

    // Next line preview text
    this.nextLineText$ = combineLatest([
      this.lyricsStore.lyrics$,
      this.lyricsStore.activeLine$
    ]).pipe(
      map(([lyrics, activeIdx]) => {
        if (!lyrics || activeIdx < 0) return '';
        return lyrics[activeIdx + 1]?.text || '';
      }),
      distinctUntilChanged()
    );

    // Word-level progress within current line (0-1)
    this.wordProgress$ = combineLatest([
      this.lyricsStore.lyrics$,
      this.lyricsStore.activeLine$,
      this.lyricsStore.interpolatedPosition$
    ]).pipe(
      map(([lyrics, activeIdx, position]) => {
        if (!lyrics || activeIdx < 0) return 0;
        const line = lyrics[activeIdx];
        if (!line || line.time === null) return 0;

        const nextLine = lyrics[activeIdx + 1];
        const lineDuration = nextLine?.time !== null && nextLine?.time !== undefined
          ? nextLine.time - line.time
          : 4000;

        const elapsed = position - line.time;
        return Math.min(1, Math.max(0, elapsed / lineDuration));
      }),
      distinctUntilChanged()
    );
  }

  private buildWordTimings(text: string, lineDuration: number): WordTiming[] {
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) return [];

    const sliceSize = 1 / words.length;
    return words.map((word, i) => ({
      text: word,
      startProgress: i * sliceSize,
      endProgress: (i + 1) * sliceSize
    }));
  }

  private estimateEnergy(timeMs: number, segments: Array<{ start: number; pitches: number[] }>): number {
    if (!segments || segments.length === 0) return 0.5;
    const seg = segments.find((s) => s.start >= timeMs);
    if (!seg) return 0.5;
    const avg = seg.pitches.reduce((a, b) => a + b, 0) / seg.pitches.length;
    return avg / 2;
  }

  private pickOrigin(energy: number): CurveOrigin {
    this.lineCounter++;
    const origins = energy > 0.4 ? INTENSE_ORIGINS : CALM_ORIGINS;
    // Use lineCounter for variety, not pure random (deterministic per line)
    return origins[this.lineCounter % origins.length];
  }

  getWordClass(word: WordTiming, progress: number): string {
    if (progress >= word.endProgress) return 'word-past';
    if (progress >= word.startProgress) return 'word-active';
    return 'word-upcoming';
  }
}
```

- [ ] **Step 2: Create the overlay template**

Create `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.component.html`:

```html
<div class="lyrics-overlay" *ngrxLet="wordProgress$ as progress">
  <div
    *ngrxLet="currentLine$ as line"
    class="line-container"
    [class.line-enter]="line"
    [style.--start-x]="line?.entryOrigin?.startX"
    [style.--start-y]="line?.entryOrigin?.startY"
    [style.--ctrl-x]="line?.entryOrigin?.controlX1"
    [style.--ctrl-y]="line?.entryOrigin?.controlY1"
  >
    <span
      *ngFor="let word of line?.words"
      class="word"
      [ngClass]="getWordClass(word, progress)"
    >{{ word.text }} </span>
  </div>
  <div class="next-line" *ngrxLet="nextLineText$ as nextText">
    {{ nextText }}
  </div>
</div>
```

- [ ] **Step 3: Create the overlay styles**

Create `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.component.scss`:

```scss
:host {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.lyrics-overlay {
  text-align: center;
  max-width: 80%;
}

.line-container {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.4;
  white-space: pre-wrap;
  min-height: 3rem;

  &.line-enter {
    animation: curvedEntry 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
}

// Curved entry animation using CSS offset-path approximation
// We use translate + opacity since true Bezier motion paths need JS
// The curve feel comes from the easing function + starting position
@keyframes curvedEntry {
  0% {
    opacity: 0;
    transform: translate(var(--start-x, -120px), var(--start-y, 0));
  }
  40% {
    opacity: 0.7;
    transform: translate(
      calc(var(--ctrl-x, 30%) - 50%),
      calc(var(--ctrl-y, 40%) - 50%)
    );
  }
  100% {
    opacity: 1;
    transform: translate(0, 0);
  }
}

.word {
  display: inline;
  transition: color 0.15s ease, text-shadow 0.15s ease;
}

.word-active {
  color: #ffffff;
  text-shadow:
    0 0 20px rgba(168, 85, 247, 0.8),
    0 0 40px rgba(168, 85, 247, 0.4);
}

.word-past {
  color: rgba(255, 255, 255, 0.55);
  text-shadow: none;
}

.word-upcoming {
  color: rgba(255, 255, 255, 0.25);
  text-shadow: none;
}

.next-line {
  @apply mt-4 text-lg;
  color: rgba(255, 255, 255, 0.15);
  font-weight: 500;
  min-height: 1.5rem;
}
```

- [ ] **Step 4: Update the module and exports**

Update `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LetDirective } from '@ngrx/component';
import { LyricsOverlayComponent } from './lyrics-overlay.component';

@NgModule({
  imports: [CommonModule, LetDirective],
  declarations: [LyricsOverlayComponent],
  exports: [LyricsOverlayComponent]
})
export class LyricsOverlayModule {}
```

Update `libs/web/lyrics/ui/lyrics-overlay/src/index.ts`:

```typescript
export * from './lib/lyrics-overlay.module';
export * from './lib/lyrics-overlay.component';
```

- [ ] **Step 5: Commit**

```bash
git add libs/web/lyrics/ui/lyrics-overlay/
git commit -m "feat(lyrics): implement lyrics overlay component with curved entry and karaoke wipe"
```

---

## Task 7: Wire Overlay into Visualizer and Update Layout

**Files:**
- Modify: `libs/web/visualizer/feature/src/lib/visualizer.component.html`
- Modify: `libs/web/visualizer/feature/src/lib/visualizer.component.ts`
- Modify: `libs/web/visualizer/feature/src/lib/visualizer.module.ts`
- Modify: `libs/web/shell/ui/layout/src/lib/layout.component.ts`
- Modify: `libs/web/shell/ui/layout/src/lib/layout.component.html`

- [ ] **Step 1: Add overlay to the visualizer feature template**

Update `libs/web/visualizer/feature/src/lib/visualizer.component.ts` to inject `LyricsStore`:

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LyricsStore } from '@angular-spotify/web/lyrics/data-access';

@Component({
  selector: 'as-visualizer',
  templateUrl: './visualizer.component.html',
  styleUrls: ['./visualizer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisualizerComponent {
  showLyricsOverlay$ = this.lyricsStore.showLyricsOverlay$;

  constructor(private lyricsStore: LyricsStore) {}
}
```

Update `libs/web/visualizer/feature/src/lib/visualizer.component.html`:

```html
<as-web-visualizer-ui></as-web-visualizer-ui>
@if (showLyricsOverlay$ | async) {
  <as-lyrics-overlay></as-lyrics-overlay>
}
```

Update `libs/web/visualizer/feature/src/lib/visualizer.component.scss` to support overlay positioning:

```scss
:host {
  overflow: hidden;
  position: relative;
}
```

- [ ] **Step 2: Import `LyricsOverlayModule` in visualizer feature module**

Update `libs/web/visualizer/feature/src/lib/visualizer.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VisualizerComponent } from './visualizer.component';
import { RouterModule } from '@angular/router';
import { WebVisualizerUiModule } from '@angular-spotify/web/visualizer/ui';
import { LyricsOverlayModule } from '@angular-spotify/web/lyrics/ui/lyrics-overlay';

@NgModule({
  imports: [
    CommonModule,
    WebVisualizerUiModule,
    LyricsOverlayModule,
    RouterModule.forChild([
      {
        path: '',
        component: VisualizerComponent
      }
    ])
  ],
  declarations: [VisualizerComponent],
  exports: [VisualizerComponent]
})
export class VisualizerModule {}
```

- [ ] **Step 3: Update layout to suppress PIP when overlay is active**

Update `libs/web/shell/ui/layout/src/lib/layout.component.ts` — add new observables:

```typescript
import { loadPlaylists } from '@angular-spotify/web/playlist/data-access';
import { PlaybackStore } from '@angular-spotify/web/shared/data-access/store';
import { VisualizerStore } from '@angular-spotify/web/visualizer/data-access';
import { LyricsStore } from '@angular-spotify/web/lyrics/data-access';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { combineLatest } from 'rxjs';
import { filter, map } from 'rxjs/operators';

@Component({
  selector: 'as-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LayoutComponent implements OnInit {
  showPiPVisualizer$ = this.visualizerStore.showPiPVisualizer$;
  lyrics$ = this.lyricsStore.lyrics$;
  activeLine$ = this.lyricsStore.activeLine$;
  isSynced$ = this.lyricsStore.isSynced$;
  currentAlbumCoverUrl$ = this.playbackStore.currentTrack$.pipe(
    map((track) => track?.album?.images[0]?.url),
    filter((imageUrl) => !!imageUrl)
  );

  // PIP lyrics: show when PIP conditions met AND overlay is NOT active
  showPiPLyrics$ = combineLatest([
    this.lyricsStore.showPiPLyrics$,
    this.lyricsStore.showLyricsOverlay$
  ]).pipe(
    map(([showPip, showOverlay]) => showPip && !showOverlay)
  );

  constructor(
    private playbackStore: PlaybackStore,
    private store: Store,
    private visualizerStore: VisualizerStore,
    public lyricsStore: LyricsStore
  ) {}

  ngOnInit(): void {
    this.store.dispatch(loadPlaylists());
  }
}
```

- [ ] **Step 4: Update layout template to pass `isSynced` and `seekTo` to PIP**

Update `libs/web/shell/ui/layout/src/lib/layout.component.html`:

```html
<as-nav-bar></as-nav-bar>
<as-top-bar></as-top-bar>
<as-main-view></as-main-view>
<as-now-playing-bar></as-now-playing-bar>
@if (currentAlbumCoverUrl$ | async; as imageUrl) {
  <as-album-art-overlay [imageUrl]="imageUrl">
  </as-album-art-overlay>
}
@if (showPiPVisualizer$ | async) {
  <as-web-visualizer-ui id="pip-visualizer"></as-web-visualizer-ui>
}
@if (showPiPLyrics$ | async) {
  <as-lyrics-pip
    id="pip-lyrics"
    [class.above-visualizer]="showPiPVisualizer$ | async"
    [lyrics]="lyrics$ | async"
    [activeLine]="(activeLine$ | async) ?? -1"
    [isSynced]="(isSynced$ | async) ?? false"
    (expand)="lyricsStore.setVisibility({ isVisible: true })"
    (closePip)="lyricsStore.setVisibility({ isVisible: false })"
  ></as-lyrics-pip>
}
```

Note: The `seekTo` output from the PIP component is not wired here yet because the `PlaybackStore` seek API would need to be used. For now, the click-to-seek in PIP emits the event but the layout doesn't consume it. This can be wired when the `PlaybackStore.seek()` method is available. The overlay component handles its own word highlighting without seeking.

- [ ] **Step 5: Verify end-to-end**

Run the app:
1. Play a track with synced lyrics
2. Navigate to `/visualizer` — lyrics overlay should appear on top of the visualizer with curved animations
3. Navigate away — lyrics PIP card should appear (scrollable)
4. Play a track with unsynced lyrics — only scrollable PIP, no overlay on visualizer

Run: `npx nx serve angular-spotify`

- [ ] **Step 6: Commit**

```bash
git add libs/web/visualizer/feature/src/lib/ libs/web/shell/ui/layout/src/lib/ 
git commit -m "feat: wire lyrics overlay into visualizer and update layout PIP logic"
```

---

## Task 8: Final Polish and Cleanup

- [ ] **Step 1: Verify the app builds without errors**

Run: `npx nx build angular-spotify`

Expected: Build succeeds with no errors.

- [ ] **Step 2: Run lint**

Run: `npx nx lint web-lyrics-ui-lyrics-overlay`

Fix any lint errors if they appear.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix lint errors and polish"
```
