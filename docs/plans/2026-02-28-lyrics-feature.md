# Lyrics Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add synced lyrics display powered by Musixmatch, with auto-scroll, click-to-seek, and PiP support — mirroring the visualizer's architecture.

**Architecture:** New `libs/web/lyrics/` domain with data-access (LyricsStore + MusixmatchApiService), feature (routed /lyrics page), and ui (lyrics-view, lyrics-pip, lyrics-toggle) libraries. Follows the same ComponentStore + route + PiP pattern as the visualizer.

**Tech Stack:** Angular 17, ngrx ComponentStore, Musixmatch API, TailwindCSS, RxJS

**Design doc:** `docs/plans/2026-02-28-lyrics-feature-design.md`

---

### Task 1: Scaffold lyrics library structure and config boilerplate

Create all library directories, project.json files, tsconfig files, jest configs, eslint configs, and index.ts barrel files. Add path aliases to tsconfig.base.json. Update AppConfig and environment files for Musixmatch.

**Files to create:**

```
libs/web/lyrics/data-access/
  project.json, tsconfig.json, tsconfig.lib.json, tsconfig.spec.json,
  jest.config.ts, .eslintrc.json, src/index.ts

libs/web/lyrics/feature/
  project.json, tsconfig.json, tsconfig.lib.json, tsconfig.spec.json,
  jest.config.ts, .eslintrc.json, src/index.ts, src/test-setup.ts

libs/web/lyrics/ui/lyrics-view/
  project.json, tsconfig.json, tsconfig.lib.json, tsconfig.spec.json,
  jest.config.ts, .eslintrc.json, src/index.ts, src/test-setup.ts

libs/web/lyrics/ui/lyrics-pip/
  project.json, tsconfig.json, tsconfig.lib.json, tsconfig.spec.json,
  jest.config.ts, .eslintrc.json, src/index.ts, src/test-setup.ts

libs/web/lyrics/ui/lyrics-toggle/
  project.json, tsconfig.json, tsconfig.lib.json, tsconfig.spec.json,
  jest.config.ts, .eslintrc.json, src/index.ts, src/test-setup.ts
```

**Files to modify:**

- `tsconfig.base.json` — add 5 path aliases
- `libs/web/shared/app-config/src/lib/app.config.ts` — add Musixmatch fields
- `apps/angular-spotify/src/environments/environment.ts` — add Musixmatch config
- `apps/angular-spotify/src/environments/environment.prod.ts` — add Musixmatch config

**Step 1: Create data-access library scaffold**

Use the visualizer data-access as a template. All config files follow the same pattern but with adjusted names and paths.

`libs/web/lyrics/data-access/project.json`:
```json
{
  "name": "web-lyrics-data-access",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/web/lyrics/data-access/src",
  "projectType": "library",
  "targets": {
    "lint": { "executor": "@nx/eslint:lint" },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/libs/web/lyrics/data-access"],
      "options": { "jestConfig": "libs/web/lyrics/data-access/jest.config.ts" }
    }
  },
  "tags": ["type:data-access", "scope:web"]
}
```

`libs/web/lyrics/data-access/jest.config.ts`:
```typescript
/* eslint-disable */
export default {
  displayName: 'web-lyrics-data-access',
  preset: '../../../../jest.preset.js',
  globals: {
    'ts-jest': { tsconfig: '<rootDir>/tsconfig.spec.json' }
  },
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]sx?$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../../../coverage/libs/web/lyrics/data-access'
};
```

`libs/web/lyrics/data-access/tsconfig.json`:
```json
{
  "extends": "../../../../tsconfig.base.json",
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.lib.json" },
    { "path": "./tsconfig.spec.json" }
  ],
  "compilerOptions": { "target": "es2020" }
}
```

`libs/web/lyrics/data-access/tsconfig.lib.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../../dist/out-tsc",
    "types": [],
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["**/*.ts"],
  "exclude": ["**/*.spec.ts", "**/*.test.ts", "jest.config.ts"]
}
```

`libs/web/lyrics/data-access/tsconfig.spec.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../../dist/out-tsc",
    "module": "commonjs",
    "types": ["jest", "node"]
  },
  "include": [
    "**/*.spec.ts", "**/*.test.ts", "**/*.spec.tsx", "**/*.test.tsx",
    "**/*.spec.js", "**/*.test.js", "**/*.spec.jsx", "**/*.test.jsx",
    "**/*.d.ts", "jest.config.ts"
  ]
}
```

`libs/web/lyrics/data-access/.eslintrc.json`:
```json
{
  "extends": ["../../../../.eslintrc.json"],
  "ignorePatterns": ["!**/*"],
  "rules": {},
  "overrides": [
    { "files": ["*.ts", "*.tsx", "*.js", "*.jsx"], "rules": {} },
    { "files": ["*.ts", "*.tsx"], "rules": {} },
    { "files": ["*.js", "*.jsx"], "rules": {} }
  ]
}
```

`libs/web/lyrics/data-access/src/index.ts`:
```typescript
export * from './lib/lyrics.models';
export * from './lib/musixmatch-api.service';
export * from './lib/lyrics.store';
```

**Step 2: Create feature library scaffold**

`libs/web/lyrics/feature/project.json`:
```json
{
  "name": "web-lyrics-feature",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "projectType": "library",
  "sourceRoot": "libs/web/lyrics/feature/src",
  "prefix": "as",
  "targets": {
    "lint": { "executor": "@nx/eslint:lint" },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/libs/web/lyrics/feature"],
      "options": { "jestConfig": "libs/web/lyrics/feature/jest.config.ts" }
    }
  },
  "tags": ["type:feature", "scope:web"]
}
```

`libs/web/lyrics/feature/jest.config.ts`:
```typescript
/* eslint-disable */
export default {
  displayName: 'web-lyrics-feature',
  preset: '../../../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  globals: {
    'ts-jest': {
      stringifyContentPathRegex: '\\.(html|svg)$',
      tsconfig: '<rootDir>/tsconfig.spec.json'
    }
  },
  coverageDirectory: '../../../../coverage/libs/web/lyrics/feature',
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment'
  ],
  transform: {
    '^.+.(ts|mjs|js|html)$': 'jest-preset-angular'
  },
  transformIgnorePatterns: ['node_modules/(?!.*.mjs$)']
};
```

`libs/web/lyrics/feature/src/test-setup.ts`:
```typescript
import 'jest-preset-angular/setup-jest';
```

`libs/web/lyrics/feature/src/index.ts`:
```typescript
export * from './lib/lyrics.module';
```

Tsconfig files follow the same pattern as data-access (copy and adjust).

**Step 3: Create UI library scaffolds** (lyrics-view, lyrics-pip, lyrics-toggle)

Each follows the same Angular component library pattern as the feature lib (with `jest-preset-angular`, `test-setup.ts`, prefix `as`). Use `type:ui` tag in project.json.

Project names: `web-lyrics-ui-lyrics-view`, `web-lyrics-ui-lyrics-pip`, `web-lyrics-ui-lyrics-toggle`.

The `.eslintrc.json` files use relative depth `../../../../../.eslintrc.json` for ui libs (5 levels deep).

`libs/web/lyrics/ui/lyrics-toggle/src/index.ts`:
```typescript
export * from './lib/lyrics-toggle.module';
```

`libs/web/lyrics/ui/lyrics-view/src/index.ts`:
```typescript
export * from './lib/lyrics-view.module';
```

`libs/web/lyrics/ui/lyrics-pip/src/index.ts`:
```typescript
export * from './lib/lyrics-pip.module';
```

**Step 4: Add path aliases to tsconfig.base.json**

Add to the `paths` object in `tsconfig.base.json`:
```json
"@angular-spotify/web/lyrics/data-access": ["libs/web/lyrics/data-access/src/index.ts"],
"@angular-spotify/web/lyrics/feature": ["libs/web/lyrics/feature/src/index.ts"],
"@angular-spotify/web/lyrics/ui/lyrics-view": ["libs/web/lyrics/ui/lyrics-view/src/index.ts"],
"@angular-spotify/web/lyrics/ui/lyrics-pip": ["libs/web/lyrics/ui/lyrics-pip/src/index.ts"],
"@angular-spotify/web/lyrics/ui/lyrics-toggle": ["libs/web/lyrics/ui/lyrics-toggle/src/index.ts"]
```

**Step 5: Update AppConfig and environment files**

Modify `libs/web/shared/app-config/src/lib/app.config.ts`:
```typescript
export interface AppConfig {
  production: boolean;
  baseURL: string;
  musixmatchApiKey: string;
  musixmatchBaseURL: string;
}
```

Modify `apps/angular-spotify/src/environments/environment.ts`:
```typescript
export const environment: AppConfig = {
  production: false,
  baseURL: 'https://api.spotify.com/v1',
  musixmatchApiKey: '', // Set your Musixmatch API key here
  musixmatchBaseURL: 'https://api.musixmatch.com/ws/1.1'
};
```

Modify `apps/angular-spotify/src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  baseURL: 'https://api.spotify.com/v1',
  musixmatchApiKey: '', // Set via CI/CD environment variable
  musixmatchBaseURL: 'https://api.musixmatch.com/ws/1.1'
};
```

**Step 6: Add `Lyrics` to RouterUtil**

Modify `libs/web/shared/utils/src/lib/router-util.ts`:
```typescript
export class RouterUtil {
  static Configuration = {
    // ... existing entries ...
    Lyrics: 'lyrics',
    SearchQueryParam: 'q'
  };
}
```

**Step 7: Verify the scaffold compiles**

Run: `npx nx lint web-lyrics-data-access`
Expected: PASS (no source files yet, just config)

**Step 8: Commit**

```bash
git add libs/web/lyrics/ tsconfig.base.json \
  libs/web/shared/app-config/src/lib/app.config.ts \
  libs/web/shared/utils/src/lib/router-util.ts \
  apps/angular-spotify/src/environments/
git commit -m "feat(lyrics): scaffold library structure and config"
```

---

### Task 2: Implement models and MusixmatchApiService

**Files to create:**
- `libs/web/lyrics/data-access/src/lib/lyrics.models.ts`
- `libs/web/lyrics/data-access/src/lib/musixmatch-api.service.ts`

**Step 1: Create lyrics models**

`libs/web/lyrics/data-access/src/lib/lyrics.models.ts`:
```typescript
export interface LyricLine {
  time: number | null; // milliseconds, null for unsynced lyrics
  text: string;
}

export type LyricsStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface LyricsState {
  lyrics: LyricLine[] | null;
  isSynced: boolean;
  isVisible: boolean;
  isShownAsPiP: boolean;
  isFirstTime: boolean;
  status: LyricsStatus;
  currentTrackId: string | null;
}

// Musixmatch API response types
export interface MusixmatchSubtitleResponse {
  message: {
    header: { status_code: number };
    body: {
      subtitle: {
        subtitle_body: string; // JSON string of [{time: {total, minutes, seconds, hundredths}, text}]
      };
    };
  };
}

export interface MusixmatchLyricsResponse {
  message: {
    header: { status_code: number };
    body: {
      lyrics: {
        lyrics_body: string; // Plain text with \n line breaks
      };
    };
  };
}

export interface MusixmatchSubtitleLine {
  text: string;
  time: {
    total: number; // seconds as float
    minutes: number;
    seconds: number;
    hundredths: number;
  };
}
```

**Step 2: Implement MusixmatchApiService**

`libs/web/lyrics/data-access/src/lib/musixmatch-api.service.ts`:
```typescript
import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { APP_CONFIG, AppConfig } from '@angular-spotify/web/shared/app-config';
import {
  LyricLine,
  MusixmatchSubtitleResponse,
  MusixmatchLyricsResponse,
  MusixmatchSubtitleLine
} from './lyrics.models';

@Injectable({ providedIn: 'root' })
export class MusixmatchApiService {
  constructor(
    @Inject(APP_CONFIG) private appConfig: AppConfig,
    private http: HttpClient
  ) {}

  /**
   * Fetch lyrics for a track. Tries synced (subtitle) first, falls back to plain lyrics.
   * Returns { lyrics, isSynced }.
   */
  getLyrics(
    trackName: string,
    artistName: string
  ): Observable<{ lyrics: LyricLine[]; isSynced: boolean }> {
    return this.getSyncedLyrics(trackName, artistName).pipe(
      switchMap((result) => {
        if (result.length > 0) {
          return of({ lyrics: result, isSynced: true });
        }
        return this.getPlainLyrics(trackName, artistName).pipe(
          map((plainLines) => ({ lyrics: plainLines, isSynced: false }))
        );
      })
    );
  }

  private getSyncedLyrics(trackName: string, artistName: string): Observable<LyricLine[]> {
    const params = {
      q_track: trackName,
      q_artist: artistName,
      apikey: this.appConfig.musixmatchApiKey,
      f_subtitle_length_max_deviation: '1'
    };

    return this.http
      .get<MusixmatchSubtitleResponse>(`${this.appConfig.musixmatchBaseURL}/matcher.subtitle.get`, {
        params
      })
      .pipe(
        map((response) => {
          if (response.message.header.status_code !== 200) {
            return [];
          }
          const subtitleBody = response.message.body?.subtitle?.subtitle_body;
          if (!subtitleBody) {
            return [];
          }
          const parsed: MusixmatchSubtitleLine[] = JSON.parse(subtitleBody);
          return parsed
            .filter((line) => line.text.trim().length > 0)
            .map((line) => ({
              time: Math.round(line.time.total * 1000), // convert seconds to ms
              text: line.text
            }));
        }),
        catchError(() => of([]))
      );
  }

  private getPlainLyrics(trackName: string, artistName: string): Observable<LyricLine[]> {
    const params = {
      q_track: trackName,
      q_artist: artistName,
      apikey: this.appConfig.musixmatchApiKey
    };

    return this.http
      .get<MusixmatchLyricsResponse>(`${this.appConfig.musixmatchBaseURL}/matcher.lyrics.get`, {
        params
      })
      .pipe(
        map((response) => {
          if (response.message.header.status_code !== 200) {
            return [];
          }
          const body = response.message.body?.lyrics?.lyrics_body;
          if (!body) {
            return [];
          }
          return body
            .split('\n')
            .filter((line) => line.trim().length > 0)
            .map((line) => ({ time: null, text: line }));
        }),
        catchError(() => of([]))
      );
  }
}
```

**Step 3: Verify compilation**

Run: `npx nx lint web-lyrics-data-access`
Expected: PASS

**Step 4: Commit**

```bash
git add libs/web/lyrics/data-access/src/
git commit -m "feat(lyrics): implement models and MusixmatchApiService"
```

---

### Task 3: Implement LyricsStore

**Files to create:**
- `libs/web/lyrics/data-access/src/lib/lyrics.store.ts`

**Step 1: Implement LyricsStore**

`libs/web/lyrics/data-access/src/lib/lyrics.store.ts`:
```typescript
import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Location } from '@angular/common';
import { ComponentStore } from '@ngrx/component-store';
import { PlaybackStore } from '@angular-spotify/web/shared/data-access/store';
import { RouterUtil, StringUtil } from '@angular-spotify/web/shared/utils';
import { EMPTY, Observable, combineLatest } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  tap,
  withLatestFrom
} from 'rxjs/operators';
import { MusixmatchApiService } from './musixmatch-api.service';
import { LyricLine, LyricsState } from './lyrics.models';

const initialState: LyricsState = {
  lyrics: null,
  isSynced: false,
  isVisible: false,
  isShownAsPiP: false,
  isFirstTime: true,
  status: 'idle',
  currentTrackId: null
};

@Injectable({ providedIn: 'root' })
export class LyricsStore extends ComponentStore<LyricsState> {
  constructor(
    private router: Router,
    private location: Location,
    private playbackStore: PlaybackStore,
    private musixmatchApi: MusixmatchApiService
  ) {
    super(initialState);
    this.showLyricsAsPiP$();
    this.watchTrackChanges$();
  }

  // Selectors
  readonly lyrics$ = this.select((s) => s.lyrics);
  readonly isSynced$ = this.select((s) => s.isSynced);
  readonly isVisible$ = this.select((s) => s.isVisible);
  readonly isShownAsPiP$ = this.select((s) => s.isShownAsPiP);
  readonly status$ = this.select((s) => s.status);
  readonly showPiPLyrics$ = this.select(
    (s) => s.isVisible && s.isShownAsPiP && s.lyrics !== null && s.lyrics.length > 0
  );

  // Active line: find the last lyric line whose time <= current playback position
  readonly activeLine$: Observable<number> = combineLatest([
    this.lyrics$,
    this.isSynced$,
    this.playbackStore.position$
  ]).pipe(
    map(([lyrics, isSynced, position]) => {
      if (!lyrics || !isSynced || position == null) {
        return -1;
      }
      let activeIndex = -1;
      for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time !== null && lyrics[i].time! <= position) {
          activeIndex = i;
        }
      }
      return activeIndex;
    }),
    distinctUntilChanged()
  );

  // Effects

  // Mirror VisualizerStore PiP pattern
  private readonly showLyricsAsPiP$ = this.effect(() =>
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e: NavigationEnd) =>
        e.urlAfterRedirects.includes(RouterUtil.Configuration.Lyrics)
      ),
      withLatestFrom(this.state$),
      tap(([isAtLyricsRoute, state]) => {
        if (isAtLyricsRoute) {
          this.setState({ ...state, isFirstTime: false, isVisible: true, isShownAsPiP: false });
        }
        if (!isAtLyricsRoute && !state.isFirstTime) {
          this.setState({ ...state, isShownAsPiP: true });
        }
      })
    )
  );

  // Watch for track changes and auto-fetch lyrics
  private readonly watchTrackChanges$ = this.effect(() =>
    this.playbackStore.currentTrack$.pipe(
      filter((track) => !!track),
      map((track) => ({
        trackId: StringUtil.getIdFromUri(track!.uri),
        trackName: track!.name,
        artistName: track!.artists[0]?.name || ''
      })),
      distinctUntilChanged((prev, curr) => prev.trackId === curr.trackId),
      withLatestFrom(this.state$),
      filter(([{ trackId }, state]) => trackId !== state.currentTrackId),
      tap(() => this.patchState({ status: 'loading' })),
      switchMap(([{ trackId, trackName, artistName }]) =>
        this.musixmatchApi.getLyrics(trackName, artistName).pipe(
          tap(({ lyrics, isSynced }) => {
            this.patchState({
              lyrics,
              isSynced,
              status: lyrics.length > 0 ? 'loaded' : 'error',
              currentTrackId: trackId
            });
          }),
          catchError(() => {
            this.patchState({ lyrics: null, isSynced: false, status: 'error', currentTrackId: trackId });
            return EMPTY;
          })
        )
      )
    )
  );

  readonly setVisibility = this.effect<{ isVisible: boolean }>((params$) =>
    params$.pipe(
      tap(({ isVisible }) => {
        this.patchState({ isVisible, isFirstTime: !isVisible });
      }),
      map(() => this.get()),
      tap((state) => this.handleStateChange(state))
    )
  );

  private handleStateChange({ isVisible, isShownAsPiP }: LyricsState) {
    if (!isVisible) {
      this.patchState({ isFirstTime: true, isShownAsPiP: false, isVisible: false });
    }

    if (isVisible && !isShownAsPiP) {
      this.router.navigate(['/', RouterUtil.Configuration.Lyrics]);
    }

    if ((isVisible && isShownAsPiP) || (!isVisible && !isShownAsPiP)) {
      if (this.location.path().includes(RouterUtil.Configuration.Lyrics)) {
        this.location.back();
      }
    }
  }
}
```

**Step 2: Update data-access barrel export**

Ensure `libs/web/lyrics/data-access/src/index.ts` exports the store (already added in Task 1).

**Step 3: Verify compilation**

Run: `npx nx lint web-lyrics-data-access`
Expected: PASS

**Step 4: Commit**

```bash
git add libs/web/lyrics/data-access/src/
git commit -m "feat(lyrics): implement LyricsStore with track watcher and PiP"
```

---

### Task 4: Implement LyricsViewComponent (full-screen UI)

**Files to create:**
- `libs/web/lyrics/ui/lyrics-view/src/lib/lyrics-view.component.ts`
- `libs/web/lyrics/ui/lyrics-view/src/lib/lyrics-view.component.html`
- `libs/web/lyrics/ui/lyrics-view/src/lib/lyrics-view.component.scss`
- `libs/web/lyrics/ui/lyrics-view/src/lib/lyrics-view.module.ts`

**Step 1: Create the component**

`libs/web/lyrics/ui/lyrics-view/src/lib/lyrics-view.component.ts`:
```typescript
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  QueryList,
  SimpleChanges,
  ViewChildren
} from '@angular/core';
import { LyricLine } from '@angular-spotify/web/lyrics/data-access';

@Component({
  selector: 'as-lyrics-view',
  templateUrl: './lyrics-view.component.html',
  styleUrls: ['./lyrics-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LyricsViewComponent implements OnChanges {
  @Input() lyrics: LyricLine[] | null = null;
  @Input() activeLine = -1;
  @Input() isSynced = false;
  @Output() seekTo = new EventEmitter<number>();
  @ViewChildren('lyricLine') lyricLines!: QueryList<ElementRef>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeLine'] && this.isSynced && this.activeLine >= 0) {
      this.scrollToActiveLine();
    }
  }

  onLineClick(line: LyricLine): void {
    if (this.isSynced && line.time !== null) {
      this.seekTo.emit(line.time);
    }
  }

  private scrollToActiveLine(): void {
    const lineElements = this.lyricLines?.toArray();
    if (!lineElements || !lineElements[this.activeLine]) {
      return;
    }
    lineElements[this.activeLine].nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}
```

`libs/web/lyrics/ui/lyrics-view/src/lib/lyrics-view.component.html`:
```html
<div class="lyrics-container">
  @if (lyrics && lyrics.length > 0) {
    <div class="lyrics-scroll">
      @for (line of lyrics; track line.text; let i = $index) {
        <p
          #lyricLine
          class="lyric-line"
          [class.active]="isSynced && i === activeLine"
          [class.past]="isSynced && activeLine >= 0 && i < activeLine"
          [class.synced]="isSynced"
          (click)="onLineClick(line)"
        >
          {{ line.text }}
        </p>
      }
    </div>
  } @else {
    <div class="no-lyrics">
      <p>No lyrics available for this track.</p>
    </div>
  }
</div>
```

`libs/web/lyrics/ui/lyrics-view/src/lib/lyrics-view.component.scss`:
```scss
:host {
  display: block;
  width: 100%;
  height: 100%;
}

.lyrics-container {
  @apply w-full h-full overflow-y-auto px-8 py-12;
  background: rgb(var(--background-baseline));
}

.lyrics-scroll {
  max-width: 800px;
  margin: 0 auto;
}

.lyric-line {
  @apply text-2xl font-bold py-2 transition-all duration-300;
  color: rgba(var(--text-baseline), 0.4);
  line-height: 1.6;

  &.synced {
    cursor: pointer;

    &:hover {
      color: rgba(var(--text-baseline), 0.7);
    }
  }

  &.active {
    color: rgb(var(--text-baseline));
    @apply text-3xl;
  }

  &.past {
    color: rgba(var(--text-baseline), 0.3);
  }
}

.no-lyrics {
  @apply flex items-center justify-center h-full;

  p {
    @apply text-xl;
    color: rgba(var(--text-baseline), 0.5);
  }
}
```

`libs/web/lyrics/ui/lyrics-view/src/lib/lyrics-view.module.ts`:
```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LyricsViewComponent } from './lyrics-view.component';

@NgModule({
  imports: [CommonModule],
  declarations: [LyricsViewComponent],
  exports: [LyricsViewComponent]
})
export class LyricsViewModule {}
```

**Step 2: Update barrel export**

`libs/web/lyrics/ui/lyrics-view/src/index.ts` already exports `LyricsViewModule`.

**Step 3: Commit**

```bash
git add libs/web/lyrics/ui/lyrics-view/
git commit -m "feat(lyrics): implement LyricsViewComponent with auto-scroll and click-to-seek"
```

---

### Task 5: Implement LyricsPipComponent

**Files to create:**
- `libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.ts`
- `libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.html`
- `libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.scss`
- `libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.module.ts`

**Step 1: Create the PiP component**

`libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.ts`:
```typescript
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { LyricLine } from '@angular-spotify/web/lyrics/data-access';

@Component({
  selector: 'as-lyrics-pip',
  templateUrl: './lyrics-pip.component.html',
  styleUrls: ['./lyrics-pip.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LyricsPipComponent {
  @Input() lyrics: LyricLine[] | null = null;
  @Input() activeLine = -1;
  @Output() expand = new EventEmitter<void>();

  get currentLine(): string {
    if (!this.lyrics || this.activeLine < 0) {
      return '';
    }
    return this.lyrics[this.activeLine]?.text || '';
  }

  get nextLine(): string {
    if (!this.lyrics || this.activeLine < 0) {
      return '';
    }
    return this.lyrics[this.activeLine + 1]?.text || '';
  }
}
```

`libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.html`:
```html
<div class="lyrics-pip" (click)="expand.emit()">
  <p class="current-line">{{ currentLine }}</p>
  <p class="next-line">{{ nextLine }}</p>
</div>
```

`libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.component.scss`:
```scss
.lyrics-pip {
  @apply p-3 rounded cursor-pointer;
  background: rgba(var(--background-highlight), 0.95);
  backdrop-filter: blur(8px);
  max-width: 400px;

  &:hover {
    background: rgba(var(--background-highlight), 1);
  }
}

.current-line {
  @apply text-sm font-bold truncate;
  color: rgb(var(--text-baseline));
}

.next-line {
  @apply text-xs truncate mt-1;
  color: rgba(var(--text-baseline), 0.5);
}
```

`libs/web/lyrics/ui/lyrics-pip/src/lib/lyrics-pip.module.ts`:
```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LyricsPipComponent } from './lyrics-pip.component';

@NgModule({
  imports: [CommonModule],
  declarations: [LyricsPipComponent],
  exports: [LyricsPipComponent]
})
export class LyricsPipModule {}
```

**Step 2: Commit**

```bash
git add libs/web/lyrics/ui/lyrics-pip/
git commit -m "feat(lyrics): implement PiP lyrics mini-panel"
```

---

### Task 6: Implement LyricsToggleComponent

**Files to create:**
- `libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.component.ts`
- `libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.component.html`
- `libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.component.scss`
- `libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.module.ts`

**Step 1: Create toggle component**

`libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.component.ts`:
```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LyricsStore } from '@angular-spotify/web/lyrics/data-access';

@Component({
  selector: 'as-lyrics-toggle',
  templateUrl: './lyrics-toggle.component.html',
  styleUrls: ['./lyrics-toggle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LyricsToggleComponent {
  isLyricsOn$ = this.lyricsStore.isVisible$;

  constructor(private lyricsStore: LyricsStore) {}

  toggle(): void {
    const isVisible = this.lyricsStore.get().isVisible;
    this.lyricsStore.setVisibility({ isVisible: !isVisible });
  }
}
```

`libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.component.html`:
```html
<button
  nz-tooltip
  nzTooltipTitle="Show lyrics"
  class="lyrics-toggle-btn"
  [class.active]="isLyricsOn$ | async"
  (click)="toggle()"
>
  <svg-icon [key]="'mic'" [fontSize]="'18px'"></svg-icon>
</button>
```

Note: The `mic` SVG icon needs to be added to the icon set. If there's no `mic` icon available, use a text-based alternative or add a new SVG icon. Check `libs/web/shared/ui/icon/` for the icon registration pattern and add a microphone/lyrics icon.

`libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.component.scss`:
```scss
.lyrics-toggle-btn {
  @apply flex items-center justify-center w-8 h-8 rounded-full transition-colors;
  color: rgba(var(--text-baseline), 0.7);

  &:hover {
    color: rgb(var(--text-baseline));
  }

  &.active {
    color: rgb(var(--text-primary));
  }
}
```

`libs/web/lyrics/ui/lyrics-toggle/src/lib/lyrics-toggle.module.ts`:
```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { SvgIconComponent } from '@ngneat/svg-icon';
import { LyricsToggleComponent } from './lyrics-toggle.component';

@NgModule({
  imports: [CommonModule, NzToolTipModule, SvgIconComponent],
  declarations: [LyricsToggleComponent],
  exports: [LyricsToggleComponent]
})
export class LyricsToggleModule {}
```

**Step 2: Commit**

```bash
git add libs/web/lyrics/ui/lyrics-toggle/
git commit -m "feat(lyrics): implement lyrics toggle button"
```

---

### Task 7: Implement LyricsComponent (feature/route container)

**Files to create:**
- `libs/web/lyrics/feature/src/lib/lyrics.component.ts`
- `libs/web/lyrics/feature/src/lib/lyrics.component.html`
- `libs/web/lyrics/feature/src/lib/lyrics.component.scss`
- `libs/web/lyrics/feature/src/lib/lyrics.module.ts`

**Step 1: Create the feature component**

`libs/web/lyrics/feature/src/lib/lyrics.component.ts`:
```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LyricsStore } from '@angular-spotify/web/lyrics/data-access';
import { PlayerApiService } from '@angular-spotify/web/shared/data-access/spotify-api';

@Component({
  selector: 'as-lyrics',
  templateUrl: './lyrics.component.html',
  styleUrls: ['./lyrics.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LyricsComponent {
  lyrics$ = this.lyricsStore.lyrics$;
  activeLine$ = this.lyricsStore.activeLine$;
  isSynced$ = this.lyricsStore.isSynced$;
  status$ = this.lyricsStore.status$;

  constructor(
    private lyricsStore: LyricsStore,
    private playerApi: PlayerApiService
  ) {}

  onSeekTo(positionMs: number): void {
    this.playerApi.seek(positionMs).subscribe();
  }
}
```

`libs/web/lyrics/feature/src/lib/lyrics.component.html`:
```html
@if (status$ | async; as status) {
  @if (status === 'loading') {
    <div class="lyrics-loading">
      <as-spinner></as-spinner>
    </div>
  } @else {
    <as-lyrics-view
      [lyrics]="lyrics$ | async"
      [activeLine]="(activeLine$ | async) ?? -1"
      [isSynced]="(isSynced$ | async) ?? false"
      (seekTo)="onSeekTo($event)"
    ></as-lyrics-view>
  }
}
```

`libs/web/lyrics/feature/src/lib/lyrics.component.scss`:
```scss
:host {
  display: block;
  width: 100%;
  height: 100%;
}

.lyrics-loading {
  @apply flex items-center justify-center w-full h-full;
}
```

`libs/web/lyrics/feature/src/lib/lyrics.module.ts`:
```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LyricsComponent } from './lyrics.component';
import { LyricsViewModule } from '@angular-spotify/web/lyrics/ui/lyrics-view';
import { SpinnerModule } from '@angular-spotify/web/shared/ui/spinner';

@NgModule({
  imports: [
    CommonModule,
    LyricsViewModule,
    SpinnerModule,
    RouterModule.forChild([
      {
        path: '',
        component: LyricsComponent
      }
    ])
  ],
  declarations: [LyricsComponent],
  exports: [LyricsComponent]
})
export class LyricsModule {}
```

**Step 2: Commit**

```bash
git add libs/web/lyrics/feature/
git commit -m "feat(lyrics): implement lyrics feature route component"
```

---

### Task 8: Wire everything into the shell (routes, now-playing bar, layout)

**Files to modify:**
- `libs/web/shell/feature/src/lib/web-shell.routes.ts` — add `/lyrics` route
- `libs/web/shell/ui/now-playing-bar/src/lib/now-playing-bar.component.html` — add toggle
- `libs/web/shell/ui/now-playing-bar/src/lib/now-playing-bar.module.ts` — import toggle module
- `libs/web/shell/ui/layout/src/lib/layout.component.ts` — add PiP observable
- `libs/web/shell/ui/layout/src/lib/layout.component.html` — add PiP template
- `libs/web/shell/ui/layout/src/lib/web-layout.module.ts` — import PiP module

**Step 1: Add `/lyrics` route**

In `libs/web/shell/feature/src/lib/web-shell.routes.ts`, add before the `collection` redirect (around line 61):
```typescript
{
  path: RouterUtil.Configuration.Lyrics,
  loadChildren: async () =>
    (await import('@angular-spotify/web/lyrics/feature')).LyricsModule
},
```

**Step 2: Add lyrics toggle to now-playing bar**

In `libs/web/shell/ui/now-playing-bar/src/lib/now-playing-bar.component.html`, add `<as-lyrics-toggle>` next to the visualization toggle (line 14):
```html
<div class="flex gap-4 items-center justify-end">
  <as-lyrics-toggle></as-lyrics-toggle>
  <as-visualization-toggle></as-visualization-toggle>
  <as-player-volume></as-player-volume>
</div>
```

In `libs/web/shell/ui/now-playing-bar/src/lib/now-playing-bar.module.ts`, add import:
```typescript
import { LyricsToggleModule } from '@angular-spotify/web/lyrics/ui/lyrics-toggle';
// Add to imports array: LyricsToggleModule
```

**Step 3: Add PiP lyrics to layout**

In `libs/web/shell/ui/layout/src/lib/layout.component.ts`, add LyricsStore:
```typescript
import { LyricsStore } from '@angular-spotify/web/lyrics/data-access';

// In constructor, add: private lyricsStore: LyricsStore

// Add class property:
showPiPLyrics$ = this.lyricsStore.showPiPLyrics$;
lyrics$ = this.lyricsStore.lyrics$;
activeLine$ = this.lyricsStore.activeLine$;
```

In `libs/web/shell/ui/layout/src/lib/layout.component.html`, add after the visualizer PiP block:
```html
@if (showPiPLyrics$ | async) {
  <as-lyrics-pip
    id="pip-lyrics"
    [lyrics]="lyrics$ | async"
    [activeLine]="(activeLine$ | async) ?? -1"
    (expand)="lyricsStore.setVisibility({ isVisible: true })"
  ></as-lyrics-pip>
}
```

Add to `libs/web/shell/ui/layout/src/lib/layout.component.scss`:
```scss
#pip-lyrics {
  position: fixed;
  right: 20px;
  bottom: 95px;
  z-index: 10;
}
```

Note: If both PiP visualizer and PiP lyrics are shown, offset `#pip-lyrics` further up:
```scss
#pip-lyrics {
  position: fixed;
  right: 20px;
  bottom: 330px; // above visualizer PiP (95px + 225px + 10px gap)
  z-index: 10;
}
```
Adjust based on testing. Alternatively, stack them using a flex column container.

In `libs/web/shell/ui/layout/src/lib/web-layout.module.ts`, add import:
```typescript
import { LyricsPipModule } from '@angular-spotify/web/lyrics/ui/lyrics-pip';
// Add to imports array: LyricsPipModule
```

**Step 4: Verify the app compiles**

Run: `npm start`
Expected: App compiles and serves. The lyrics toggle button appears next to the visualizer toggle in the now-playing bar.

**Step 5: Commit**

```bash
git add libs/web/shell/
git commit -m "feat(lyrics): wire lyrics into shell routes, now-playing bar, and layout PiP"
```

---

### Task 9: Add mic/lyrics SVG icon

The lyrics toggle uses an `svg-icon` with key `'mic'`. This project uses `@ngneat/svg-icon` with a custom svg-generator.

**Step 1: Investigate the icon setup**

Check `libs/web/shared/ui/icon/` and `package.json` svg-generator config to understand how icons are registered. Look at how existing icons (like `audio-animated`) are defined.

**Step 2: Add a microphone SVG**

Add a `mic.svg` file to the SVG icons source directory (likely `libs/web/shared/assets/`). The SVG should be a simple microphone or lyrics icon (16x16 or 24x24 viewbox).

**Step 3: Run the icon generator**

Run: `npm run generate-icons`
Expected: New icon type is generated.

**Step 4: Verify the icon renders**

Run: `npm start` and check the lyrics toggle in the now-playing bar.

**Step 5: Commit**

```bash
git add libs/web/shared/
git commit -m "feat(lyrics): add mic SVG icon for lyrics toggle"
```

---

### Task 10: Manual integration testing

**Step 1: Set Musixmatch API key**

Add your Musixmatch API key to `apps/angular-spotify/src/environments/environment.ts`.

**Step 2: Test synced lyrics**

1. Start the dev server: `npm start`
2. Play a popular track (e.g., a well-known English song)
3. Click the lyrics toggle button
4. Verify: navigates to `/lyrics`, lyrics appear, active line scrolls as music plays
5. Click a lyric line → playback seeks to that timestamp

**Step 3: Test unsynced fallback**

Play a less popular or regional track where synced lyrics may not be available. Verify plain lyrics display without auto-scroll or click-to-seek.

**Step 4: Test PiP**

1. While on `/lyrics`, click "Home" in the sidebar
2. Verify: PiP lyrics panel appears in the bottom-right showing current + next line
3. Click the PiP panel → navigates back to `/lyrics`

**Step 5: Test toggle off**

Click the lyrics toggle again while on `/lyrics`. Verify: navigates back, PiP doesn't appear.

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat(lyrics): complete lyrics feature with Musixmatch integration"
```
