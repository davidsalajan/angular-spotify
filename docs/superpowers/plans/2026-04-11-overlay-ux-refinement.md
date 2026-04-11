# Lyrics Overlay UX Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the lyrics overlay an explicit user-toggled feature in the visualizer toolbar, increase overlay font size, simplify PIP logic, and disable the lyrics toggle when no lyrics are available.

**Architecture:** Move overlay toggle from automatic `showLyricsOverlay$` (cross-store selector in LyricsStore) to a simple boolean `isLyricsOverlayOn` in VisualizerStore. Add a lyrics icon button to the visualizer toolbar (hidden when no synced lyrics). Revert layout PIP logic to the simple version. Disable lyrics toggle on now-playing bar when no lyrics exist.

**Tech Stack:** Angular 15+, NgRx ComponentStore, RxJS, Tailwind CSS

---

## File Structure

### Modified Files

| File | What Changes |
|------|-------------|
| `libs/web/visualizer/data-access/src/lib/store/visualizer.store.ts` | Add `isLyricsOverlayOn` state, toggle updater, and `showLyricsOverlay$` selector |
| `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.ts` | Inject `LyricsStore`, expose `hasSyncedLyrics$` and `isLyricsOverlayOn$`, add toggle method |
| `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.html` | Add lyrics icon button next to renderer selector |
| `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.scss` | Style for active lyrics button |
| `libs/web/visualizer/ui/src/lib/web-visualizer-ui.module.ts` | No change needed (SvgIconComponent already imported) |
| `libs/web/visualizer/feature/src/lib/visualizer.component.ts` | Switch from `LyricsStore.showLyricsOverlay$` to `VisualizerStore.showLyricsOverlay$` |
| `libs/web/lyrics/data-access/src/lib/lyrics.store.ts` | Remove `showLyricsOverlay$`, `isVisualizerFullScreen$`, and `VisualizerStore` dependency |
| `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.component.scss` | Increase font sizes to match full lyrics view |
| `libs/web/shell/ui/layout/src/lib/layout.component.ts` | Revert `showPiPLyrics$` to simple version |
| `libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.component.ts` | Add `hasLyrics$` observable, expose to template |
| `libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.component.html` | Add `[disabled]` binding |
| `libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.component.scss` | Add disabled style |

---

## Task 1: Add Lyrics Overlay Toggle to VisualizerStore

**Files:**
- Modify: `libs/web/visualizer/data-access/src/lib/store/visualizer.store.ts`

- [ ] **Step 1: Add `isLyricsOverlayOn` to state and create toggle + selector**

In `libs/web/visualizer/data-access/src/lib/store/visualizer.store.ts`:

Add `isLyricsOverlayOn: boolean` to `VisualizerState` interface:

```typescript
interface VisualizerState {
  isFirstTime: boolean;
  isShownAsPiP: boolean;
  isVisible: boolean;
  selectedVisualizerType: VisualizerType;
  isLyricsOverlayOn: boolean;
}
```

Update the initial state in the constructor:

```typescript
  constructor(private router: Router, private location: Location) {
    super({ isVisible: false, isShownAsPiP: false, isFirstTime: true, selectedVisualizerType: VisualizerType.Particles, isLyricsOverlayOn: false });
    this.showVisualizerAsPiP$();
  }
```

Add selector and updater after the existing `visualizerType$`:

```typescript
  readonly isLyricsOverlayOn$ = this.select((s) => s.isLyricsOverlayOn);

  // Overlay shows when toggled on AND visualizer is full-screen (not PIP)
  readonly showLyricsOverlay$ = this.select(
    (s) => s.isLyricsOverlayOn && s.isVisible && !s.isShownAsPiP
  );

  readonly toggleLyricsOverlay = this.updater((state) => ({
    ...state,
    isLyricsOverlayOn: !state.isLyricsOverlayOn
  }));
```

- [ ] **Step 2: Commit**

```bash
git add libs/web/visualizer/data-access/src/lib/store/visualizer.store.ts
git commit -m "feat(visualizer): add lyrics overlay toggle to store"
```

---

## Task 2: Add Lyrics Icon Button to Visualizer Toolbar

**Files:**
- Modify: `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.ts`
- Modify: `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.html`
- Modify: `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.scss`

- [ ] **Step 1: Update the component class**

In `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.ts`:

Add import for `LyricsStore`:

```typescript
import { LyricsStore } from '@angular-spotify/web/lyrics/data-access';
```

Add `combineLatest` to the rxjs import:

```typescript
import { combineLatest, timer } from 'rxjs';
```

Add new observables after existing properties (around line 41):

```typescript
  // Only show lyrics overlay button when synced lyrics are available
  hasSyncedLyrics$ = this.lyricsStore.isSynced$;
  isLyricsOverlayOn$ = this.visualizerStore.isLyricsOverlayOn$;
```

Inject `LyricsStore` in the constructor:

```typescript
  constructor(
    private playbackStore: PlaybackStore,
    @Inject(DOCUMENT) private readonly document: Document,
    private visualizerStore: VisualizerStore,
    private lyricsStore: LyricsStore
  ) {}
```

Add toggle method:

```typescript
  toggleLyricsOverlay(): void {
    this.visualizerStore.toggleLyricsOverlay();
  }
```

- [ ] **Step 2: Update the template**

Replace the contents of `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.html`:

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
    *ngIf="hasSyncedLyrics$ | async"
    (click)="toggleLyricsOverlay()"
    class="action-btn"
    [class.active]="isLyricsOverlayOn$ | async"
    title="Show lyrics on visualizer"
  >
    <svg-icon [key]="'mic'" [fontSize]="'16px'"></svg-icon>
  </button>
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

- [ ] **Step 3: Add active style for the lyrics button**

In `libs/web/visualizer/ui/src/lib/web-visualizer-ui.component.scss`, add inside the `.action-btn` rule:

```scss
    &.active {
      color: rgb(var(--text-primary, 29 185 84));
    }
```

- [ ] **Step 4: Verify build**

Run: `npx nx build angular-spotify --skip-nx-cache`
Expected: Build passes.

- [ ] **Step 5: Commit**

```bash
git add libs/web/visualizer/ui/src/lib/
git commit -m "feat(visualizer): add lyrics overlay toggle button to toolbar"
```

---

## Task 3: Remove `showLyricsOverlay$` from LyricsStore and Clean Up

**Files:**
- Modify: `libs/web/lyrics/data-access/src/lib/lyrics.store.ts`

- [ ] **Step 1: Remove overlay-related code and VisualizerStore dependency**

In `libs/web/lyrics/data-access/src/lib/lyrics.store.ts`:

Remove the import:

```typescript
import { VisualizerStore } from '@angular-spotify/web/visualizer/data-access';
```

Revert the constructor to remove `VisualizerStore`:

```typescript
  constructor(
    private router: Router,
    private location: Location,
    private playbackStore: PlaybackStore,
    private lrclibApi: LrclibApiService
  ) {
    super(initialState);
    this.showLyricsAsPiP$();
    this.watchTrackChanges$();
  }
```

Remove these two selectors entirely (lines 56-73 in current file):

```typescript
  // DELETE: isVisualizerFullScreen$
  // DELETE: showLyricsOverlay$
```

Keep `interpolatedPosition$` as `readonly` (public) — the overlay component still uses it.

- [ ] **Step 2: Commit**

```bash
git add libs/web/lyrics/data-access/src/lib/lyrics.store.ts
git commit -m "refactor(lyrics): remove showLyricsOverlay$ and VisualizerStore dep"
```

---

## Task 4: Update Visualizer Feature and Layout to Use New Toggle

**Files:**
- Modify: `libs/web/visualizer/feature/src/lib/visualizer.component.ts`
- Modify: `libs/web/visualizer/feature/src/lib/visualizer.component.html`
- Modify: `libs/web/shell/ui/layout/src/lib/layout.component.ts`

- [ ] **Step 1: Switch visualizer feature to use VisualizerStore**

Replace `libs/web/visualizer/feature/src/lib/visualizer.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VisualizerStore } from '@angular-spotify/web/visualizer/data-access';

@Component({
  selector: 'as-visualizer',
  templateUrl: './visualizer.component.html',
  styleUrls: ['./visualizer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisualizerComponent {
  showLyricsOverlay$ = this.visualizerStore.showLyricsOverlay$;

  constructor(private visualizerStore: VisualizerStore) {}
}
```

The template (`visualizer.component.html`) stays the same — it already uses `showLyricsOverlay$ | async`.

- [ ] **Step 2: Revert layout PIP logic to simple version**

Replace `libs/web/shell/ui/layout/src/lib/layout.component.ts`:

```typescript
import { loadPlaylists } from '@angular-spotify/web/playlist/data-access';
import { PlaybackStore } from '@angular-spotify/web/shared/data-access/store';
import { VisualizerStore } from '@angular-spotify/web/visualizer/data-access';
import { LyricsStore } from '@angular-spotify/web/lyrics/data-access';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { filter, map } from 'rxjs/operators';

@Component({
  selector: 'as-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LayoutComponent implements OnInit {
  showPiPVisualizer$ = this.visualizerStore.showPiPVisualizer$;
  showPiPLyrics$ = this.lyricsStore.showPiPLyrics$;
  lyrics$ = this.lyricsStore.lyrics$;
  activeLine$ = this.lyricsStore.activeLine$;
  isSynced$ = this.lyricsStore.isSynced$;
  currentAlbumCoverUrl$ = this.playbackStore.currentTrack$.pipe(
    map((track) => track?.album?.images[0]?.url),
    filter((imageUrl) => !!imageUrl)
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

- [ ] **Step 3: Verify build**

Run: `npx nx build angular-spotify --skip-nx-cache`
Expected: Build passes.

- [ ] **Step 4: Commit**

```bash
git add libs/web/visualizer/feature/src/lib/visualizer.component.ts libs/web/shell/ui/layout/src/lib/layout.component.ts
git commit -m "refactor: use VisualizerStore toggle, revert layout PIP logic"
```

---

## Task 5: Increase Overlay Font Sizes

**Files:**
- Modify: `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.component.scss`

- [ ] **Step 1: Update font sizes to match full lyrics view**

Replace `libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.component.scss`:

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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.previous-line {
  @apply text-xl md:text-2xl lg:text-3xl;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.2);
  min-height: 1.75rem;
  transition: opacity 0.4s ease;
}

.current-line {
  @apply text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold;
  line-height: 1.1;
  color: #ffffff;
  min-height: 3rem;
  text-shadow:
    0 0 20px rgba(168, 85, 247, 0.8),
    0 0 40px rgba(168, 85, 247, 0.4);

  // Curved entry animation
  &.line-enter {
    animation: curvedEntry 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  // Gentle floating drift while active
  &.line-float {
    animation:
      curvedEntry 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards,
      gentleFloat 4s ease-in-out 0.6s infinite;
  }
}

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

@keyframes gentleFloat {
  0%, 100% {
    transform: translate(0, 0);
  }
  25% {
    transform: translate(8px, -4px);
  }
  50% {
    transform: translate(-5px, 3px);
  }
  75% {
    transform: translate(4px, -2px);
  }
}

.next-line {
  @apply text-xl md:text-2xl lg:text-3xl;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.15);
  min-height: 1.75rem;
}
```

- [ ] **Step 2: Commit**

```bash
git add libs/web/lyrics/ui/lyrics-overlay/src/lib/lyrics-overlay.component.scss
git commit -m "feat(lyrics): increase overlay font sizes to match full lyrics view"
```

---

## Task 6: Disable Lyrics Toggle When No Lyrics Available

**Files:**
- Modify: `libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.component.ts`
- Modify: `libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.component.html`
- Modify: `libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.component.scss`

- [ ] **Step 1: Add `hasLyrics$` observable to the component**

Replace `libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LyricsStore } from '@angular-spotify/web/lyrics/data-access';
import { map } from 'rxjs/operators';

@Component({
  selector: 'as-lyrics-toggle',
  templateUrl: './lyrics-toggle.component.html',
  styleUrls: ['./lyrics-toggle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LyricsToggleComponent {
  isLyricsOn$ = this.lyricsStore.isVisible$;
  hasLyrics$ = this.lyricsStore.lyrics$.pipe(
    map((lyrics) => lyrics !== null && lyrics.length > 0)
  );
  private isVisible = false;

  constructor(private lyricsStore: LyricsStore) {
    this.isLyricsOn$.subscribe((v) => (this.isVisible = v));
  }

  toggle(): void {
    this.lyricsStore.setVisibility({ isVisible: !this.isVisible });
  }
}
```

- [ ] **Step 2: Update the template**

Replace `libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.component.html`:

```html
<button
  nz-tooltip
  [nzTooltipTitle]="(hasLyrics$ | async) ? 'Show lyrics' : 'No lyrics available'"
  class="lyrics-toggle-btn"
  [class.active]="isLyricsOn$ | async"
  [disabled]="(hasLyrics$ | async) === false"
  (click)="toggle()"
>
  <svg-icon [key]="'mic'" [fontSize]="'18px'"></svg-icon>
</button>
```

- [ ] **Step 3: Add disabled style**

In `libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.component.scss`, add after the existing `&.active` rule:

```scss
  &:disabled {
    color: rgba(var(--text-baseline), 0.2);
    cursor: not-allowed;

    &:hover {
      color: rgba(var(--text-baseline), 0.2);
    }
  }
```

- [ ] **Step 4: Verify build**

Run: `npx nx build angular-spotify --skip-nx-cache`
Expected: Build passes.

- [ ] **Step 5: Commit**

```bash
git add libs/web/lyrics/ui/lyrics-toggle/src/lib/
git commit -m "feat(lyrics): disable toggle button when no lyrics available"
```

---

## Task 7: Final Build Verification

- [ ] **Step 1: Verify the full app builds**

Run: `npx nx build angular-spotify --skip-nx-cache`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run lint on changed libraries**

Run: `npx nx lint web-visualizer-data-access && npx nx lint web-lyrics-ui-lyrics-overlay`
Fix any lint errors.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix lint errors"
```
