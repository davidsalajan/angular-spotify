# Lyrics Annotation (Scalable Language Pairs + Kanji→Romaji) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize the shipped pinyin-lyrics feature into a config-driven "lyrics annotation" architecture and ship Japanese→romaji as the second language pair.

**Architecture:** Each language pair is a declarative `AnnotatorConfig` in a registry; detection picks one config per song. The existing `PinyinStore` machinery (windowing, focus-sorted queue, batching, generation guards) becomes the generic `LyricsAnnotationStore`, dispatching AI work through a small `AnnotationEngine` interface (only the Prompt-API engine exists today; a Translator-API engine slots in later). Spec: `docs/superpowers/specs/2026-07-13-lyrics-annotation-design.md`.

**Tech Stack:** Angular 17 (Nx monorepo), @ngrx/component-store, Jest, Chrome built-in AI (`LanguageModel` / `LanguageDetector` globals).

## Global Constraints

- Branch: `feat/lyrics-annotation` (already created; spec commit `a818d11` is on it).
- Node 18 via `.nvmrc`; package manager is **yarn**. Run Nx as `yarn nx <target>`.
- Test commands: `yarn nx test <project>` with project names `web-lyrics-data-access`, `web-lyrics-ui-lyrics-view`, `web-lyrics-ui-pinyin-toggle`, `web-lyrics-feature`, `web-shared-data-access-built-in-ai`, `web-shell-ui-now-playing-bar`.
- Chinese songs must behave **identically** after the refactor (the migrated store specs are the regression proof).
- The `pinyin-toggle` Nx lib keeps its folder and import alias `@angular-spotify/web/lyrics/ui/pinyin-toggle` (renaming Nx projects is deliberate out-of-scope churn); the component **inside** it is renamed.
- Copy strings (exact): `'Downloading language model…'`, `'Preparing pinyin…'`, `'Preparing romaji…'` (Unicode ellipsis `…`, not three dots).
- Browser verification uses **http://127.0.0.1:4200/** (never `localhost`) driven via Playwriter, per repo CLAUDE.md.
- Every task ends with its listed tests passing and a commit.

---

### Task 1: Script utilities (`containsJapanese`)

**Files:**
- Rename: `libs/web/lyrics/data-access/src/lib/han-util.ts` → `script-util.ts`
- Rename: `libs/web/lyrics/data-access/src/lib/han-util.spec.ts` → `script-util.spec.ts`
- Modify: `libs/web/lyrics/data-access/src/index.ts`
- Modify: `libs/web/lyrics/data-access/src/lib/pinyin.store.ts` (import path only)

**Interfaces:**
- Consumes: nothing new.
- Produces: `containsHan(text: string): boolean` (unchanged), `containsJapanese(text: string): boolean` — both exported from `./lib/script-util` and re-exported by the lib index. Task 3's romaji config uses `containsJapanese`.

- [ ] **Step 1: Rename the files with git mv**

```bash
cd /Users/trung.vo/Source/angular-spotify
git mv libs/web/lyrics/data-access/src/lib/han-util.ts libs/web/lyrics/data-access/src/lib/script-util.ts
git mv libs/web/lyrics/data-access/src/lib/han-util.spec.ts libs/web/lyrics/data-access/src/lib/script-util.spec.ts
```

- [ ] **Step 2: Fix the two import sites**

In `libs/web/lyrics/data-access/src/index.ts` change `export * from './lib/han-util';` to `export * from './lib/script-util';`.
In `libs/web/lyrics/data-access/src/lib/pinyin.store.ts` change `import { containsHan } from './han-util';` to `import { containsHan } from './script-util';`.
In `script-util.spec.ts` change the import from `'./han-util'` to `'./script-util'`.

- [ ] **Step 3: Write the failing tests for `containsJapanese`**

Append to `libs/web/lyrics/data-access/src/lib/script-util.spec.ts` (add `containsJapanese` to the existing import):

```ts
describe('containsJapanese', () => {
  it('is true for hiragana-only lines', () => {
    expect(containsJapanese('ありがとう')).toBe(true);
  });

  it('is true for katakana-only lines', () => {
    expect(containsJapanese('サヨナラ')).toBe(true);
  });

  it('is true for kanji-only lines (kanji are Han codepoints)', () => {
    expect(containsJapanese('愛')).toBe(true);
  });

  it('is true for mixed kanji+kana lines', () => {
    expect(containsJapanese('君の名前')).toBe(true);
  });

  it('is false for Latin-only lines', () => {
    expect(containsJapanese('Instrumental')).toBe(false);
  });

  it('is false for symbol-only lines', () => {
    expect(containsJapanese('♪')).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests to verify the new ones fail**

Run: `yarn nx test web-lyrics-data-access --testPathPattern=script-util`
Expected: FAIL — `containsJapanese` is not exported.

- [ ] **Step 5: Implement `containsJapanese`**

`libs/web/lyrics/data-access/src/lib/script-util.ts` becomes:

```ts
const HAN_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/; // escaped: U+F900 literal gets NFC-normalized to U+8C48
// Hiragana (U+3040–U+309F) + Katakana (U+30A0–U+30FF).
const KANA_REGEX = /[\u3040-\u30FF]/;

export function containsHan(text: string): boolean {
  return HAN_REGEX.test(text);
}

/**
 * True when a line contains any Japanese script — kana, or kanji (which are
 * Han-block codepoints). Song-level language detection decides ja vs zh; this
 * only filters out lines with nothing to romanize (Latin, ♪, "Instrumental").
 */
export function containsJapanese(text: string): boolean {
  return KANA_REGEX.test(text) || containsHan(text);
}
```

- [ ] **Step 6: Run the lib's full test suite**

Run: `yarn nx test web-lyrics-data-access`
Expected: PASS (all existing pinyin/han tests plus the 6 new ones).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(lyrics): rename han-util to script-util, add containsJapanese"
```

---

### Task 2: Generic BuiltInAiService API + AnnotationEngine

**Files:**
- Modify: `libs/web/shared/data-access/built-in-ai/src/lib/built-in-ai.types.ts`
- Modify: `libs/web/shared/data-access/built-in-ai/src/lib/built-in-ai.service.ts`
- Modify: `libs/web/shared/data-access/built-in-ai/src/lib/built-in-ai.service.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Task 4's store):
  - `checkAvailability(languages: string[]): Promise<AiAvailability>`
  - `createSession(systemPrompt: string, opts?: CreateSessionOptions): Promise<AnnotationSession>`
  - `promptBatch(session: AnnotationSession, instruction: string, lines: string[], signal?: AbortSignal): Promise<string[]>`
  - `createPromptEngine(spec: PromptEngineSpec): AnnotationEngine` where `PromptEngineSpec = { systemPrompt: string; batchInstruction: string }` and `AnnotationEngine = { ensureReady(opts?: CreateSessionOptions): Promise<void>; annotateBatch(lines: string[], signal?: AbortSignal): Promise<string[]>; destroy(): void }`
  - Type `AnnotationSession` (renamed `PinyinSession`; deprecated alias kept until Task 4).
- The old `PINYIN_SYSTEM_PROMPT`, `createPinyinSession`, `promptPinyinBatch` remain as deprecated wrappers so `pinyin.store.ts` keeps compiling; **Task 4 deletes them.**

- [ ] **Step 1: Write failing tests for the generic API**

Append to `built-in-ai.service.spec.ts` (extend the existing type import with `AnnotationSession`):

```ts
describe('BuiltInAiService — generic annotation API', () => {
  let service: BuiltInAiService;
  afterEach(() => {
    (globalThis as any).LanguageModel = undefined;
  });
  beforeEach(() => {
    service = new BuiltInAiService();
  });

  const fakeSession = (output: string): AnnotationSession => ({
    prompt: jest.fn().mockResolvedValue(output),
    destroy: jest.fn()
  });

  it('checkAvailability returns unavailable when the global is missing', async () => {
    (globalThis as any).LanguageModel = undefined;
    expect(await service.checkAvailability(['ja', 'en'])).toBe('unavailable');
  });

  it('checkAvailability passes the languages through to LanguageModel.availability', async () => {
    const availability = jest.fn().mockResolvedValue('available');
    (globalThis as any).LanguageModel = { availability, create: jest.fn() };
    expect(await service.checkAvailability(['ja', 'en'])).toBe('available');
    expect(availability).toHaveBeenCalledWith({ languages: ['ja', 'en'] });
  });

  it('checkAvailability returns unavailable when availability throws', async () => {
    (globalThis as any).LanguageModel = {
      availability: jest.fn().mockRejectedValue(new Error('boom')),
      create: jest.fn()
    };
    expect(await service.checkAvailability(['ja', 'en'])).toBe('unavailable');
  });

  it('createSession passes the given system prompt', async () => {
    const create = jest.fn().mockResolvedValue(fakeSession('[]'));
    (globalThis as any).LanguageModel = { create };
    await service.createSession('You are a romaji transliterator.');
    expect(create.mock.calls[0][0].initialPrompts[0]).toEqual({
      role: 'system',
      content: 'You are a romaji transliterator.'
    });
  });

  it('promptBatch prefixes the instruction and parses the JSON array', async () => {
    const session = fakeSession('["ki mi", "no na"]');
    const result = await service.promptBatch(session, 'Convert to romaji.', ['君', 'の名']);
    expect(result).toEqual(['ki mi', 'no na']);
    expect((session.prompt as jest.Mock).mock.calls[0][0]).toBe('Convert to romaji.\n\n君\nの名');
  });

  it('promptBatch throws on length mismatch', async () => {
    const session = fakeSession('["one"]');
    await expect(service.promptBatch(session, 'x', ['a', 'b'])).rejects.toThrow();
  });

  it('createPromptEngine creates the session once across ensureReady calls and prompts with the spec', async () => {
    const session = fakeSession('["kimi no"]');
    const create = jest.fn().mockResolvedValue(session);
    (globalThis as any).LanguageModel = { create };
    const engine = service.createPromptEngine({
      systemPrompt: 'SYS',
      batchInstruction: 'INSTR'
    });
    await engine.ensureReady();
    await engine.ensureReady();
    expect(create).toHaveBeenCalledTimes(1);
    const result = await engine.annotateBatch(['君の']);
    expect(result).toEqual(['kimi no']);
    expect((session.prompt as jest.Mock).mock.calls[0][0]).toBe('INSTR\n\n君の');
  });

  it('createPromptEngine.destroy destroys the session and allows a fresh one', async () => {
    const session = fakeSession('[]');
    const create = jest.fn().mockResolvedValue(session);
    (globalThis as any).LanguageModel = { create };
    const engine = service.createPromptEngine({ systemPrompt: 'SYS', batchInstruction: 'I' });
    await engine.ensureReady();
    engine.destroy();
    expect(session.destroy).toHaveBeenCalled();
    await engine.ensureReady();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('createPromptEngine.annotateBatch rejects when ensureReady has not run', async () => {
    (globalThis as any).LanguageModel = { create: jest.fn() };
    const engine = service.createPromptEngine({ systemPrompt: 'SYS', batchInstruction: 'I' });
    await expect(engine.annotateBatch(['a'])).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn nx test web-shared-data-access-built-in-ai`
Expected: FAIL — `checkAvailability`, `createSession`, `promptBatch`, `createPromptEngine` do not exist.

- [ ] **Step 3: Update the types file**

`built-in-ai.types.ts` — rename the session type and add the engine types. Full new content of the non-global section (the `declare global` block stays exactly as-is except `Promise<PinyinSession>` becomes `Promise<AnnotationSession>` in `LanguageModel.create`):

```ts
export type AiAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

export interface LanguageDetectionResult {
  lang: string;
  confidence: number;
}

export interface AnnotationSession {
  prompt(input: string, opts?: { signal?: AbortSignal }): Promise<string>;
  destroy(): void;
}

/** @deprecated Use AnnotationSession. Removed in the lyrics-annotation store migration. */
export type PinyinSession = AnnotationSession;

export interface CreateSessionOptions {
  onDownloadProgress?: (loaded: number) => void;
  signal?: AbortSignal;
}

/** What a prompt-based annotator needs from the Prompt API. */
export interface PromptEngineSpec {
  systemPrompt: string;
  batchInstruction: string;
}

/**
 * A prepared annotation backend for one song. Today only the Prompt API
 * implementation exists (createPromptEngine); a Translator-API engine for
 * translation pairs implements the same interface later.
 */
export interface AnnotationEngine {
  ensureReady(opts?: CreateSessionOptions): Promise<void>;
  annotateBatch(lines: string[], signal?: AbortSignal): Promise<string[]>;
  destroy(): void;
}
```

- [ ] **Step 4: Rewrite the service with the generic API + deprecated wrappers**

Full new content of `built-in-ai.service.ts`:

```ts
import { Injectable } from '@angular/core';
import {
  AiAvailability,
  AnnotationEngine,
  AnnotationSession,
  CreateSessionOptions,
  LanguageDetectionResult,
  PromptEngineSpec
} from './built-in-ai.types';

/** @deprecated Lives in the pinyin annotator config after the store migration. */
export const PINYIN_SYSTEM_PROMPT =
  'You are a precise Chinese-to-Hanyu-Pinyin transliterator. ' +
  'Output pinyin WITH tone marks (ā á ǎ à). Do not translate meaning.';

const PINYIN_BATCH_INSTRUCTION =
  'Convert each line of this Chinese text to Hanyu Pinyin with tone marks. ' +
  'Return ONLY a JSON array of strings, one pinyin line per input line, no extra text.';

@Injectable({ providedIn: 'root' })
export class BuiltInAiService {
  isPromptApiAvailable(): boolean {
    return typeof globalThis.LanguageModel !== 'undefined';
  }

  isDetectorAvailable(): boolean {
    return typeof globalThis.LanguageDetector !== 'undefined';
  }

  async checkAvailability(languages: string[]): Promise<AiAvailability> {
    if (!globalThis.LanguageModel) {
      return 'unavailable';
    }
    try {
      return await globalThis.LanguageModel.availability({ languages });
    } catch {
      return 'unavailable';
    }
  }

  async detectLanguage(text: string): Promise<LanguageDetectionResult | null> {
    if (!this.isDetectorAvailable()) {
      return null;
    }
    try {
      const t0 = performance.now();
      const detector = await globalThis.LanguageDetector!.create();
      const results = await detector.detect(text);
      console.log(`[BuiltInAI] detectLanguage: ${(performance.now() - t0).toFixed(1)}ms`);
      const top = results[0];
      return top ? { lang: top.detectedLanguage, confidence: top.confidence } : null;
    } catch {
      return null;
    }
  }

  async createSession(
    systemPrompt: string,
    opts: CreateSessionOptions = {}
  ): Promise<AnnotationSession> {
    if (!this.isPromptApiAvailable()) {
      throw new Error('Prompt API unavailable');
    }
    const t0 = performance.now();
    const session = await globalThis.LanguageModel!.create({
      initialPrompts: [{ role: 'system', content: systemPrompt }],
      signal: opts.signal,
      monitor: (m) =>
        m.addEventListener('downloadprogress', (e) => opts.onDownloadProgress?.(e.loaded))
    });
    console.log(`[BuiltInAI] createSession: ${(performance.now() - t0).toFixed(1)}ms`);
    return session;
  }

  async promptBatch(
    session: AnnotationSession,
    instruction: string,
    lines: string[],
    signal?: AbortSignal
  ): Promise<string[]> {
    const prompt = `${instruction}\n\n${lines.join('\n')}`;
    const t0 = performance.now();
    const raw = await session.prompt(prompt, { signal });
    console.log(`[BuiltInAI] promptBatch ← ${(performance.now() - t0).toFixed(1)}ms for ${lines.length} lines`);
    const parsed = this.parseArray(raw);
    if (!parsed || parsed.length !== lines.length) {
      throw new Error(`Batch parse failed: expected ${lines.length} lines`);
    }
    return parsed;
  }

  /**
   * A lazily-prepared Prompt API engine bound to one annotator's prompts.
   * ensureReady is idempotent; destroy releases the session (a new ensureReady
   * recreates it).
   */
  createPromptEngine(spec: PromptEngineSpec): AnnotationEngine {
    let session: AnnotationSession | null = null;
    return {
      ensureReady: async (opts: CreateSessionOptions = {}) => {
        if (!session) {
          session = await this.createSession(spec.systemPrompt, opts);
        }
      },
      annotateBatch: (lines: string[], signal?: AbortSignal) => {
        if (!session) {
          return Promise.reject(new Error('Annotation engine not ready'));
        }
        return this.promptBatch(session, spec.batchInstruction, lines, signal);
      },
      destroy: () => {
        session?.destroy();
        session = null;
      }
    };
  }

  /** @deprecated Use createSession. Removed in the lyrics-annotation store migration. */
  createPinyinSession(opts: CreateSessionOptions = {}): Promise<AnnotationSession> {
    return this.createSession(PINYIN_SYSTEM_PROMPT, opts);
  }

  /** @deprecated Use promptBatch. Removed in the lyrics-annotation store migration. */
  promptPinyinBatch(
    session: AnnotationSession,
    lines: string[],
    signal?: AbortSignal
  ): Promise<string[]> {
    return this.promptBatch(session, PINYIN_BATCH_INSTRUCTION, lines, signal);
  }

  private parseArray(raw: string): string[] | null {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) {
      return null;
    }
    try {
      const value = JSON.parse(match[0]);
      return Array.isArray(value) && value.every((v) => typeof v === 'string') ? value : null;
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 5: Run the suite — old pinyin tests must still pass via the wrappers**

Run: `yarn nx test web-shared-data-access-built-in-ai`
Expected: PASS — all pre-existing tests (wrappers preserve behavior, including the system prompt containing "Pinyin") plus the 9 new ones.

- [ ] **Step 6: Verify dependent projects still compile**

Run: `yarn nx test web-lyrics-data-access`
Expected: PASS (pinyin.store.ts still uses the deprecated wrappers).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(built-in-ai): generic createSession/promptBatch + AnnotationEngine, deprecate pinyin-specific API"
```

---

### Task 3: Annotation models, annotator configs, registry

**Files:**
- Create: `libs/web/lyrics/data-access/src/lib/annotation.models.ts`
- Create: `libs/web/lyrics/data-access/src/lib/annotators/pinyin.annotator.ts`
- Create: `libs/web/lyrics/data-access/src/lib/annotators/romaji.annotator.ts`
- Create: `libs/web/lyrics/data-access/src/lib/annotators/index.ts`
- Create: `libs/web/lyrics/data-access/src/lib/annotators/annotators.spec.ts`
- Modify: `libs/web/lyrics/data-access/src/index.ts`

**Interfaces:**
- Consumes: `containsHan`, `containsJapanese` from `../script-util` (Task 1).
- Produces (used by Task 4):
  - Types: `AnnotationStatus`, `AnnotationLineState { text: string; annotation: string | null; status: AnnotationStatus }`, `AnnotationSupport`, `AnnotationDownloadState`, `AnnotatorKind`, `AnnotatorToggleConfig`, `AnnotatorConfig`, `AnnotationState`
  - Constants: `LOOKAHEAD = 10`, `BATCH_SIZE = 8`, `MIN_CONFIDENCE = 0.5`, `DETECT_SAMPLE_LINES = 5`
  - Configs: `PINYIN_ANNOTATOR`, `ROMAJI_ANNOTATOR`
  - Registry: `ANNOTATORS: AnnotatorConfig[]`, `findAnnotatorForLanguage(lang: string): AnnotatorConfig | null`, `getAnnotatorById(id: string): AnnotatorConfig | null`
- Note: `pinyin.models.ts` is NOT touched here (deleted in Task 4). `PREFETCH_MARGIN` from the old models file is unused anywhere (verify: `grep -rn PREFETCH_MARGIN libs apps` shows only its definition) and is intentionally not carried over.

- [ ] **Step 1: Write the models file**

`libs/web/lyrics/data-access/src/lib/annotation.models.ts`:

```ts
export type AnnotationStatus = 'pending' | 'loading' | 'done' | 'error';

export interface AnnotationLineState {
  text: string;
  annotation: string | null;
  status: AnnotationStatus;
}

export type AnnotationSupport = 'unknown' | 'unsupported' | 'supported';
export type AnnotationDownloadState = 'idle' | 'downloading' | 'ready';

/** Grows to `'prompt' | 'translator'` when translation pairs land. */
export type AnnotatorKind = 'prompt';

export interface AnnotatorToggleConfig {
  /** Glyph rendered in the now-playing-bar toggle button (拼, あ). */
  icon: string;
  tooltipShow: string;
  tooltipHide: string;
  /** Page-pill text before the first line renders ("Preparing pinyin…"). */
  preparingLabel: string;
}

/**
 * One language pair, declaratively. Adding a transliteration pair = one config
 * file + one entry in the ANNOTATORS registry; the store machinery is shared.
 */
export interface AnnotatorConfig {
  id: string;
  kind: AnnotatorKind;
  /** Matched against the BCP-47 tag from LanguageDetector (e.g. 'zh-Hant', 'ja'). */
  matchesLanguage(lang: string): boolean;
  /** Which lines get an annotation entry (skips ♪ / Latin-only lines). */
  lineQualifies(text: string): boolean;
  /** Passed to LanguageModel.availability() — support is checked per pair. */
  expectedLanguages: string[];
  systemPrompt: string;
  batchInstruction: string;
  toggle: AnnotatorToggleConfig;
}

export interface AnnotationState {
  enabled: boolean;
  support: AnnotationSupport;
  downloadState: AnnotationDownloadState;
  /** Registry id of the annotator matching the detected language, else null. */
  activeAnnotatorId: string | null;
  annotationByIndex: Record<number, AnnotationLineState>;
  activeLine: number;
  windowEnd: number;
  visibleRange: { start: number; end: number } | null;
}

export const LOOKAHEAD = 10;
export const BATCH_SIZE = 8;
export const MIN_CONFIDENCE = 0.5;
export const DETECT_SAMPLE_LINES = 5;
```

- [ ] **Step 2: Write the failing registry/config tests**

`libs/web/lyrics/data-access/src/lib/annotators/annotators.spec.ts`:

```ts
import { ANNOTATORS, findAnnotatorForLanguage, getAnnotatorById } from './index';
import { PINYIN_ANNOTATOR } from './pinyin.annotator';
import { ROMAJI_ANNOTATOR } from './romaji.annotator';

describe('annotator registry', () => {
  it('registers pinyin and romaji', () => {
    expect(ANNOTATORS).toEqual([PINYIN_ANNOTATOR, ROMAJI_ANNOTATOR]);
  });

  it('picks pinyin for zh variants', () => {
    expect(findAnnotatorForLanguage('zh')).toBe(PINYIN_ANNOTATOR);
    expect(findAnnotatorForLanguage('zh-Hant')).toBe(PINYIN_ANNOTATOR);
  });

  it('picks romaji for ja', () => {
    expect(findAnnotatorForLanguage('ja')).toBe(ROMAJI_ANNOTATOR);
  });

  it('returns null for languages with no annotator', () => {
    expect(findAnnotatorForLanguage('en')).toBeNull();
    expect(findAnnotatorForLanguage('vi')).toBeNull();
  });

  it('looks up annotators by id', () => {
    expect(getAnnotatorById('pinyin')).toBe(PINYIN_ANNOTATOR);
    expect(getAnnotatorById('romaji')).toBe(ROMAJI_ANNOTATOR);
    expect(getAnnotatorById('nope')).toBeNull();
  });
});

describe('pinyin annotator config', () => {
  it('qualifies Han lines only', () => {
    expect(PINYIN_ANNOTATOR.lineQualifies('你好')).toBe(true);
    expect(PINYIN_ANNOTATOR.lineQualifies('instrumental break')).toBe(false);
  });

  it('keeps the shipped prompts and toggle copy', () => {
    expect(PINYIN_ANNOTATOR.systemPrompt).toContain('Hanyu-Pinyin');
    expect(PINYIN_ANNOTATOR.batchInstruction).toContain('JSON array');
    expect(PINYIN_ANNOTATOR.toggle.icon).toBe('拼');
    expect(PINYIN_ANNOTATOR.toggle.preparingLabel).toBe('Preparing pinyin…');
    expect(PINYIN_ANNOTATOR.expectedLanguages).toEqual(['zh', 'en']);
  });
});

describe('romaji annotator config', () => {
  it('qualifies kana-only, kanji-only and mixed lines; skips Latin/symbols', () => {
    expect(ROMAJI_ANNOTATOR.lineQualifies('ありがとう')).toBe(true);
    expect(ROMAJI_ANNOTATOR.lineQualifies('愛')).toBe(true);
    expect(ROMAJI_ANNOTATOR.lineQualifies('君の名前')).toBe(true);
    expect(ROMAJI_ANNOTATOR.lineQualifies('Instrumental')).toBe(false);
    expect(ROMAJI_ANNOTATOR.lineQualifies('♪')).toBe(false);
  });

  it('declares Hepburn romaji prompts and toggle copy', () => {
    expect(ROMAJI_ANNOTATOR.systemPrompt).toContain('Hepburn');
    expect(ROMAJI_ANNOTATOR.batchInstruction).toContain('JSON array');
    expect(ROMAJI_ANNOTATOR.toggle.icon).toBe('あ');
    expect(ROMAJI_ANNOTATOR.toggle.preparingLabel).toBe('Preparing romaji…');
    expect(ROMAJI_ANNOTATOR.expectedLanguages).toEqual(['ja', 'en']);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `yarn nx test web-lyrics-data-access --testPathPattern=annotators`
Expected: FAIL — modules don't exist.

- [ ] **Step 4: Write the pinyin config**

`libs/web/lyrics/data-access/src/lib/annotators/pinyin.annotator.ts`:

```ts
import { AnnotatorConfig } from '../annotation.models';
import { containsHan } from '../script-util';

export const PINYIN_ANNOTATOR: AnnotatorConfig = {
  id: 'pinyin',
  kind: 'prompt',
  matchesLanguage: (lang) => lang.startsWith('zh'),
  lineQualifies: containsHan,
  expectedLanguages: ['zh', 'en'],
  systemPrompt:
    'You are a precise Chinese-to-Hanyu-Pinyin transliterator. ' +
    'Output pinyin WITH tone marks (ā á ǎ à). Do not translate meaning.',
  batchInstruction:
    'Convert each line of this Chinese text to Hanyu Pinyin with tone marks. ' +
    'Return ONLY a JSON array of strings, one pinyin line per input line, no extra text.',
  toggle: {
    icon: '拼',
    tooltipShow: 'Show pinyin',
    tooltipHide: 'Hide pinyin',
    preparingLabel: 'Preparing pinyin…'
  }
};
```

- [ ] **Step 5: Write the romaji config**

`libs/web/lyrics/data-access/src/lib/annotators/romaji.annotator.ts`:

```ts
import { AnnotatorConfig } from '../annotation.models';
import { containsJapanese } from '../script-util';

export const ROMAJI_ANNOTATOR: AnnotatorConfig = {
  id: 'romaji',
  kind: 'prompt',
  matchesLanguage: (lang) => lang.startsWith('ja'),
  lineQualifies: containsJapanese,
  expectedLanguages: ['ja', 'en'],
  systemPrompt:
    'You are a precise Japanese-to-romaji transliterator. ' +
    'Romanize kanji, hiragana, and katakana into Hepburn romaji ' +
    'with macrons for long vowels (ō, ū). Do not translate meaning.',
  batchInstruction:
    'Convert each line of this Japanese text to Hepburn romaji. ' +
    'Return ONLY a JSON array of strings, one romaji line per input line, no extra text.',
  toggle: {
    icon: 'あ',
    tooltipShow: 'Show romaji',
    tooltipHide: 'Hide romaji',
    preparingLabel: 'Preparing romaji…'
  }
};
```

- [ ] **Step 6: Write the registry**

`libs/web/lyrics/data-access/src/lib/annotators/index.ts`:

```ts
import { AnnotatorConfig } from '../annotation.models';
import { PINYIN_ANNOTATOR } from './pinyin.annotator';
import { ROMAJI_ANNOTATOR } from './romaji.annotator';

export { PINYIN_ANNOTATOR } from './pinyin.annotator';
export { ROMAJI_ANNOTATOR } from './romaji.annotator';

/** Order matters: the FIRST config whose matchesLanguage passes wins. */
export const ANNOTATORS: AnnotatorConfig[] = [PINYIN_ANNOTATOR, ROMAJI_ANNOTATOR];

export function findAnnotatorForLanguage(lang: string): AnnotatorConfig | null {
  return ANNOTATORS.find((a) => a.matchesLanguage(lang)) ?? null;
}

export function getAnnotatorById(id: string): AnnotatorConfig | null {
  return ANNOTATORS.find((a) => a.id === id) ?? null;
}
```

- [ ] **Step 7: Export from the lib index**

In `libs/web/lyrics/data-access/src/index.ts` add (keep existing lines, including the pinyin ones for now):

```ts
export * from './lib/annotation.models';
export * from './lib/annotators';
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `yarn nx test web-lyrics-data-access`
Expected: PASS (new annotators suite + all existing suites).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(lyrics): declarative annotator configs and registry (pinyin + romaji)"
```

---

### Task 4: LyricsAnnotationStore + lyrics view/page migration

The big rename: `PinyinStore` → `LyricsAnnotationStore` driven by the registry, plus the two consumers that use the renamed observables (`LyricsViewComponent`, `LyricsComponent`). The toggle lib keeps compiling through a temporary `PinyinStore` alias export (its member names — `showToggle$`, `enabled$`, `setEnabled` — don't change); Task 5 removes the alias.

**Files:**
- Rename: `libs/web/lyrics/data-access/src/lib/pinyin.store.ts` → `lyrics-annotation.store.ts`
- Rename: `libs/web/lyrics/data-access/src/lib/pinyin.store.spec.ts` → `lyrics-annotation.store.spec.ts`
- Delete: `libs/web/lyrics/data-access/src/lib/pinyin.models.ts`
- Modify: `libs/web/lyrics/data-access/src/index.ts`
- Modify: `libs/web/shared/data-access/built-in-ai/src/lib/built-in-ai.service.ts` (remove deprecated wrappers) and `built-in-ai.types.ts` (remove `PinyinSession` alias); remove the 5 old pinyin-named tests from `built-in-ai.service.spec.ts` (`describe('BuiltInAiService — pinyin', …)` block)
- Modify: `libs/web/lyrics/ui/lyrics-view/src/lib/lyrics-view.component.ts`, `.html`, `.scss`, `.spec.ts`
- Modify: `libs/web/lyrics/feature/src/lib/lyrics.component.ts`, `.html`, `.scss`

**Interfaces:**
- Consumes: Task 2's `createPromptEngine`/`checkAvailability`/`AnnotationEngine`; Task 3's models/registry.
- Produces (public store API used by Tasks 5+):
  - `LyricsAnnotationStore` with `enabled$`, `downloadState$`, `annotationByIndex$: Observable<Record<number, AnnotationLineState>>`, `visibleRange$`, `activeAnnotator$: Observable<AnnotatorConfig | null>`, `hasRenderedAnnotation$`, `showToggle$`, `pageStatusText$: Observable<string | null>`, `setEnabled(boolean)`, `setActiveLine(number)`, `setVisibleRange(range | null)`, `init(lines)`
  - Temporary: `export { LyricsAnnotationStore as PinyinStore }` (removed in Task 5)
  - `LyricsViewComponent` inputs become `annotationByIndex: Record<number, AnnotationLineState>` and `annotationEnabled: boolean`; helper `annotationFor(index): string | null`
  - CSS classes: `pinyin-line` → `annotation-line` (and `--hidden` modifier), keyframes `pinyin-in` → `annotation-in`; feature: `pinyin-status` → `annotation-status` (`__dot`, keyframes `annotation-status-in`, `annotation-status-pulse`)

- [ ] **Step 1: Rename store + spec files**

```bash
git mv libs/web/lyrics/data-access/src/lib/pinyin.store.ts libs/web/lyrics/data-access/src/lib/lyrics-annotation.store.ts
git mv libs/web/lyrics/data-access/src/lib/pinyin.store.spec.ts libs/web/lyrics/data-access/src/lib/lyrics-annotation.store.spec.ts
```

- [ ] **Step 2: Migrate the spec file (this is the failing-test step for the store)**

Apply this exact rename table across `lyrics-annotation.store.spec.ts`:

| Old | New |
|---|---|
| `import { PinyinStore } from './pinyin.store'` | `import { LyricsAnnotationStore } from './lyrics-annotation.store'` |
| `PinyinStore` (all other occurrences) | `LyricsAnnotationStore` |
| `store.pinyinByIndex$` | `store.annotationByIndex$` |
| `store.hasRenderedPinyin$` | `store.hasRenderedAnnotation$` |
| `store.pinyinPageStatus$` | `store.pageStatusText$` |
| `toBe('preparing')` | `toBe('Preparing pinyin…')` |
| `toBe('downloading')` (on page-status reads) | `toBe('Downloading language model…')` |
| `pinyin: null` (in expected line-state objects) | `annotation: null` |

Replace the AI-mock shape in **every** `beforeEach`. Old shape (`createPinyinSession`/`promptPinyinBatch`) becomes an engine-based mock. Use this pattern in all four describe blocks (adjust the `annotateBatch` default per block to mirror what `promptPinyinBatch` returned there):

```ts
const makeEngine = () => ({
  ensureReady: jest.fn().mockResolvedValue(undefined),
  annotateBatch: jest.fn().mockResolvedValue([]),
  destroy: jest.fn()
});

let engine: ReturnType<typeof makeEngine>;
let ai: {
  isPromptApiAvailable: jest.Mock;
  isDetectorAvailable: jest.Mock;
  checkAvailability: jest.Mock;
  detectLanguage: jest.Mock;
  createPromptEngine: jest.Mock;
};

beforeEach(() => {
  engine = makeEngine();
  ai = {
    isPromptApiAvailable: jest.fn().mockReturnValue(true),
    isDetectorAvailable: jest.fn().mockReturnValue(true),
    checkAvailability: jest.fn().mockResolvedValue('available'),
    detectLanguage: jest.fn().mockResolvedValue({ lang: 'zh', confidence: 0.95 }),
    createPromptEngine: jest.fn(() => engine)
  };
  // ...unchanged TestBed setup, providing LyricsAnnotationStore...
});
```

Then map the per-test mock interactions:

| Old | New |
|---|---|
| `ai.createPinyinSession` call-count asserts | `ai.createPromptEngine` call-count asserts |
| `ai.promptPinyinBatch.mockResolvedValue(x)` | `engine.annotateBatch.mockResolvedValue(x)` |
| `ai.promptPinyinBatch.mockRejectedValueOnce(...)` | `engine.annotateBatch.mockRejectedValueOnce(...)` |
| `ai.promptPinyinBatch.mockImplementation(...)` (serial-drain, slow-batch tests) | `engine.annotateBatch.mockImplementation(...)` |
| `expect(ai.promptPinyinBatch)...` asserts | `expect(engine.annotateBatch)...` |
| `ai.promptPinyinBatch: jest.fn((_s, b) => Promise.resolve(b.map(...)))` (track-change block) | `engine.annotateBatch: jest.fn((b: string[]) => Promise.resolve(b.map((t) => 'py-' + t)))` — note: no session arg |
| session `destroy` tracking via `ai._destroy` | `engine.destroy` (assert `expect(engine.destroy).toHaveBeenCalled()`) |
| `ai.createPinyinSession.mockReturnValue(new Promise(() => undefined))` ("downloading" test) | `engine.ensureReady.mockReturnValue(new Promise(() => undefined))` |
| `capturedOpts` download-progress test capturing `createPinyinSession` opts | capture `engine.ensureReady` opts instead: `engine.ensureReady.mockImplementationOnce((opts) => { capturedOpts = opts; return Promise.resolve(); })` |

Then append these NEW tests to the "detection gating" describe block:

```ts
it('activates romaji for Japanese lyrics', async () => {
  ai.detectLanguage.mockResolvedValue({ lang: 'ja', confidence: 0.9 });
  engine.annotateBatch.mockResolvedValue(['arigatō']);
  store.init([{ time: 0, text: 'ありがとう' }]);
  await flush();
  store.setActiveLine(0);
  await flush();
  await flush();
  const map = read<Record<number, any>>(store.annotationByIndex$);
  expect(map[0]).toEqual({ text: 'ありがとう', annotation: 'arigatō', status: 'done' });
  // The engine was built from the romaji config's prompts.
  expect(ai.createPromptEngine.mock.calls[0][0].systemPrompt).toContain('Hepburn');
  expect(read<string | null>(store.pageStatusText$)).toBeNull();
});

it('checks availability with the matched annotator languages and stays silent when unavailable', async () => {
  ai.detectLanguage.mockResolvedValue({ lang: 'ja', confidence: 0.9 });
  ai.checkAvailability.mockResolvedValue('unavailable');
  store.init([{ time: 0, text: 'ありがとう' }]);
  await flush();
  expect(ai.checkAvailability).toHaveBeenCalledWith(['ja', 'en']);
  expect(read<boolean>(store.showToggle$)).toBe(false);
  expect(read<string | null>(store.pageStatusText$)).toBeNull();
  expect(ai.createPromptEngine).not.toHaveBeenCalled();
});

it('stays silent for a detected language with no registered annotator', async () => {
  ai.detectLanguage.mockResolvedValue({ lang: 'vi', confidence: 0.99 });
  store.init([{ time: 0, text: 'xin chào' }]);
  await flush();
  expect(read<boolean>(store.showToggle$)).toBe(false);
  expect(ai.checkAvailability).not.toHaveBeenCalled();
});

it('reports the romaji preparing label for a Japanese song', async () => {
  ai.detectLanguage.mockResolvedValue({ lang: 'ja', confidence: 0.9 });
  store.init([{ time: 0, text: 'ありがとう' }]);
  await flush();
  expect(read<string | null>(store.pageStatusText$)).toBe('Preparing romaji…');
});
```

And append this NEW test to the "track change" describe block (uses that block's `lines()` helper; declare `let engineA`/`engineB` locally):

```ts
it('destroys an engine whose preparation finishes after a track change instead of adopting it', async () => {
  let resolveReady!: () => void;
  const engineA = {
    ensureReady: jest.fn(() => new Promise<void>((r) => { resolveReady = r; })),
    annotateBatch: jest.fn(),
    destroy: jest.fn()
  };
  const engineB = {
    ensureReady: jest.fn().mockResolvedValue(undefined),
    annotateBatch: jest.fn((b: string[]) => Promise.resolve(b.map(() => 'rōmaji'))),
    destroy: jest.fn()
  };
  ai.createPromptEngine.mockReturnValueOnce(engineA).mockReturnValueOnce(engineB);

  lyrics$.next(lines(3, 'a'));            // zh track
  await flush();
  store.setActiveLine(0);                  // drain starts; engineA.ensureReady pending
  await flush();

  ai.detectLanguage.mockResolvedValueOnce({ lang: 'ja', confidence: 0.9 });
  lyrics$.next([{ time: 0, text: 'ありがとう' }]);  // ja track before engineA is ready
  await flush();

  resolveReady();                          // stale zh engine finishes preparing late
  await flush();
  store.setActiveLine(0);
  await flush();
  await flush();

  expect(engineA.destroy).toHaveBeenCalled();      // orphan destroyed, never adopted
  expect(engineB.annotateBatch).toHaveBeenCalled(); // ja track got its own engine
  expect(engineA.annotateBatch).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the store spec to verify it fails**

Run: `yarn nx test web-lyrics-data-access --testPathPattern=lyrics-annotation.store`
Expected: FAIL — `LyricsAnnotationStore` doesn't exist yet.

- [ ] **Step 4: Write the store**

Full new content of `libs/web/lyrics/data-access/src/lib/lyrics-annotation.store.ts`:

```ts
import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { AnnotationEngine, BuiltInAiService } from '@angular-spotify/web/shared/data-access/built-in-ai';
import { combineLatest, Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { LyricsStore } from './lyrics.store';
import { LyricLine } from './lyrics.models';
import { findAnnotatorForLanguage, getAnnotatorById } from './annotators';
import {
  AnnotationLineState,
  AnnotationState,
  AnnotatorConfig,
  BATCH_SIZE,
  DETECT_SAMPLE_LINES,
  LOOKAHEAD,
  MIN_CONFIDENCE
} from './annotation.models';

const initialState: AnnotationState = {
  enabled: true,
  support: 'unknown',
  downloadState: 'idle',
  activeAnnotatorId: null,
  annotationByIndex: {},
  activeLine: -1,
  windowEnd: -1,
  visibleRange: null
};

@Injectable({ providedIn: 'root' })
export class LyricsAnnotationStore extends ComponentStore<AnnotationState> {
  /** Shared engine for all batch calls within a song; recreated per track. */
  private engine: AnnotationEngine | null = null;
  private draining = false;
  private queue: number[] = [];
  /** Incremented on every reset(); drainQueue frames check this to detect stale runs. */
  private generation = 0;

  constructor(private ai: BuiltInAiService, private lyricsStore: LyricsStore) {
    super(initialState);
    this.watchLyrics();
    this.watchActiveLine();
  }

  readonly enabled$ = this.select((s) => s.enabled);
  readonly downloadState$ = this.select((s) => s.downloadState);
  readonly annotationByIndex$ = this.select((s) => s.annotationByIndex);
  readonly visibleRange$ = this.select((s) => s.visibleRange);

  /** The registry config matching the detected language, or null when none applies. */
  readonly activeAnnotator$: Observable<AnnotatorConfig | null> = this.select((s) =>
    s.activeAnnotatorId ? getAnnotatorById(s.activeAnnotatorId) : null
  );

  /** True once at least one line has rendered its annotation. */
  readonly hasRenderedAnnotation$: Observable<boolean> = this.select((s) =>
    Object.values(s.annotationByIndex).some((line) => line.status === 'done')
  );

  /**
   * Only surface the toggle once annotations actually start rendering — before
   * that there is nothing to show/hide, and the page-level status conveys progress.
   */
  readonly showToggle$: Observable<boolean> = this.select(
    (s) =>
      s.activeAnnotatorId !== null &&
      s.support === 'supported' &&
      Object.values(s.annotationByIndex).some((line) => line.status === 'done')
  );

  /**
   * Status text for the lyrics-page pill (bottom-right) before any annotation
   * appears. Null once annotations render (they are then the feedback) or when
   * the feature doesn't apply. The "preparing" copy comes from the active config.
   */
  readonly pageStatusText$: Observable<string | null> = this.select((s): string | null => {
    if (!s.activeAnnotatorId || s.support !== 'supported') return null;
    const config = getAnnotatorById(s.activeAnnotatorId);
    if (!config) return null;
    const hasAnnotation = Object.values(s.annotationByIndex).some((l) => l.status === 'done');
    if (hasAnnotation) return null;
    return s.downloadState === 'downloading'
      ? 'Downloading language model…'
      : config.toggle.preparingLabel;
  });

  setEnabled(enabled: boolean): void {
    this.patchState({ enabled });
    if (enabled) this.enqueue();
  }

  setActiveLine(line: number): void {
    const windowEnd = line + LOOKAHEAD;
    this.patchState({ activeLine: line, windowEnd });
    this.enqueue();
  }

  setVisibleRange(range: { start: number; end: number } | null): void {
    this.patchState({ visibleRange: range });
    this.enqueue();
  }

  init(lines: LyricLine[]): void {
    this.reset();
    if (!this.ai.isPromptApiAvailable()) {
      this.patchState({ support: 'unsupported' });
      return;
    }
    void this.detectAndSeed(lines);
  }

  private async detectAndSeed(lines: LyricLine[]): Promise<void> {
    const gen = this.generation;
    const sample = lines
      .slice(0, DETECT_SAMPLE_LINES)
      .map((l) => l.text)
      .join('\n');
    const detection = await this.ai.detectLanguage(sample);
    // Guard: if reset() was called while we awaited detection, bail out.
    if (gen !== this.generation) return;
    const config =
      detection && detection.confidence >= MIN_CONFIDENCE
        ? findAnnotatorForLanguage(detection.lang)
        : null;
    if (!config) {
      this.patchState({ activeAnnotatorId: null });
      return;
    }
    // Support is per pair: Gemini Nano may be available for zh but not ja.
    const availability = await this.ai.checkAvailability(config.expectedLanguages);
    if (gen !== this.generation) return;
    if (availability === 'unavailable') {
      this.patchState({ support: 'unsupported', activeAnnotatorId: null });
      return;
    }
    const annotationByIndex: Record<number, AnnotationLineState> = {};
    lines.forEach((line, i) => {
      if (config.lineQualifies(line.text)) {
        annotationByIndex[i] = { text: line.text, annotation: null, status: 'pending' };
      }
    });
    this.patchState({ support: 'supported', activeAnnotatorId: config.id, annotationByIndex });
    // A paused song doesn't advance activeLine$, and detection may resolve after
    // the last activeLine emission — so the active-line driver would never open a
    // window and annotations would never generate. Seed one now around the current
    // active line so visible annotations appear immediately. (Unsynced lyrics report
    // activeLine -1 and are driven by the viewport observer instead.)
    this.lyricsStore.activeLine$.pipe(take(1)).subscribe((activeLine) => {
      if (activeLine >= 0) this.setActiveLine(activeLine);
    });
  }

  private get focus(): number {
    const { activeLine, visibleRange } = this.get();
    return activeLine >= 0 ? activeLine : visibleRange ? visibleRange.start : 0;
  }

  private enqueue(): void {
    const { enabled, activeAnnotatorId, support, annotationByIndex, windowEnd, visibleRange } =
      this.get();
    if (!enabled || !activeAnnotatorId || support !== 'supported') return;
    const indices: number[] = [];
    for (const key of Object.keys(annotationByIndex)) {
      const index = Number(key);
      const entry = annotationByIndex[index];
      if (entry.status !== 'pending') continue;
      if (windowEnd >= 0) {
        if (index <= windowEnd) indices.push(index);
      } else {
        if (visibleRange && index >= visibleRange.start && index <= visibleRange.end) {
          indices.push(index);
        }
      }
    }
    // Intentionally replace queue while draining may be active; shared reference ensures
    // the running drainQueue loop picks up new content on its next while iteration.
    this.queue = indices;
    void this.drainQueue();
  }

  private nextBatch(): number[] {
    const f = this.focus;
    this.queue.sort((a, b) => Math.abs(a - f) - Math.abs(b - f));
    return this.queue.splice(0, BATCH_SIZE);
  }

  /**
   * config.kind === 'prompt' is the only engine today; a future 'translator'
   * kind adds a branch here without touching the drain machinery.
   */
  private createEngineFor(config: AnnotatorConfig): AnnotationEngine {
    return this.ai.createPromptEngine({
      systemPrompt: config.systemPrompt,
      batchInstruction: config.batchInstruction
    });
  }

  private async drainQueue(): Promise<void> {
    if (this.draining || !this.get().enabled) return;
    const { activeAnnotatorId } = this.get();
    const config = activeAnnotatorId ? getAnnotatorById(activeAnnotatorId) : null;
    if (!config) return;
    this.draining = true;
    const gen = this.generation;
    try {
      if (!this.engine) {
        const engine = this.createEngineFor(config);
        this.patchState({ downloadState: 'downloading' });
        await engine.ensureReady({
          onDownloadProgress: () => this.patchState({ downloadState: 'downloading' })
        });
        // Guard: if reset() fired while we awaited preparation, this engine belongs
        // to a dead generation — destroy it rather than adopting it, so a zh→ja
        // track switch can never reuse a session with the wrong system prompt.
        if (gen !== this.generation) {
          engine.destroy();
          return;
        }
        this.engine = engine;
        this.patchState({ downloadState: 'ready' });
      }
      const engine = this.engine;
      while (this.queue.length > 0) {
        if (!this.get().enabled) break;
        const batch = this.nextBatch();
        if (batch.length === 0) break;
        // Guard: if reset() fired since we entered this loop iteration, bail out
        // before writing loading state into the new track's map.
        if (gen !== this.generation) break;
        const patch: Record<number, AnnotationLineState> = {};
        for (const idx of batch) {
          patch[idx] = { ...this.get().annotationByIndex[idx], status: 'loading' };
        }
        this.patchMany(patch);
        try {
          const texts = batch.map((i) => this.get().annotationByIndex[i].text);
          const results = await engine.annotateBatch(texts);
          // Generation guard: discard stale results from a previous track.
          if (gen !== this.generation) return;
          const donePatch: Record<number, AnnotationLineState> = {};
          batch.forEach((idx, i) => {
            donePatch[idx] = {
              ...this.get().annotationByIndex[idx],
              annotation: results[i],
              status: 'done'
            };
          });
          this.patchMany(donePatch);
        } catch {
          // Generation guard: don't write error state for a previous track either.
          if (gen !== this.generation) return;
          const errPatch: Record<number, AnnotationLineState> = {};
          for (const idx of batch) {
            errPatch[idx] = { ...this.get().annotationByIndex[idx], status: 'error' };
          }
          this.patchMany(errPatch);
        }
      }
    } finally {
      // Only clear the draining flag if we still own this generation.
      if (gen === this.generation) {
        this.draining = false;
      }
    }
  }

  private patchMany(patch: Record<number, AnnotationLineState>): void {
    this.patchState((s) => ({
      annotationByIndex: { ...s.annotationByIndex, ...patch }
    }));
  }

  private reset(): void {
    this.engine?.destroy();
    this.engine = null;
    this.generation++;
    this.draining = false;
    this.queue = [];
    this.patchState({
      support: 'unknown',
      downloadState: 'idle',
      activeAnnotatorId: null,
      annotationByIndex: {},
      activeLine: -1,
      windowEnd: -1,
      visibleRange: null
    });
  }

  private watchActiveLine(): void {
    combineLatest([this.lyricsStore.isSynced$, this.lyricsStore.activeLine$]).subscribe(
      ([isSynced, activeLine]) => {
        const { activeAnnotatorId, enabled } = this.get();
        if (isSynced && activeAnnotatorId && enabled && activeLine >= 0) {
          this.setActiveLine(activeLine);
        }
      }
    );
  }

  private watchLyrics(): void {
    this.lyricsStore.lyrics$.subscribe((lines) => {
      if (lines && lines.length > 0) {
        this.init(lines);
      } else {
        this.reset();
      }
    });
  }
}

/** @deprecated Temporary alias for the toggle lib; removed in the toggle migration task. */
export { LyricsAnnotationStore as PinyinStore };
```

- [ ] **Step 5: Delete the old models, update the index, drop the service wrappers**

1. `git rm libs/web/lyrics/data-access/src/lib/pinyin.models.ts`
2. `libs/web/lyrics/data-access/src/index.ts` — full new content:

```ts
export * from './lib/lyrics.models';
export * from './lib/lrclib-api.service';
export * from './lib/lyrics.store';
export * from './lib/script-util';
export * from './lib/annotation.models';
export * from './lib/annotators';
export * from './lib/lyrics-annotation.store';
```

3. In `built-in-ai.service.ts` delete `PINYIN_SYSTEM_PROMPT`, `PINYIN_BATCH_INSTRUCTION`, `createPinyinSession`, `promptPinyinBatch`.
4. In `built-in-ai.types.ts` delete the `PinyinSession` deprecated alias.
5. In `built-in-ai.service.spec.ts` delete the entire `describe('BuiltInAiService — pinyin', …)` block (its coverage was replicated generically in Task 2) and remove `PinyinSession` from imports if referenced.

- [ ] **Step 6: Run the store spec**

Run: `yarn nx test web-lyrics-data-access --testPathPattern=lyrics-annotation.store`
Expected: PASS — all migrated tests + the 5 new ones.

- [ ] **Step 7: Migrate LyricsViewComponent**

`lyrics-view.component.ts` — apply exactly:

| Old | New |
|---|---|
| `import ... PinyinLineState } from '@angular-spotify/web/lyrics/data-access'` | `AnnotationLineState` |
| `@Input() pinyinByIndex: Record<number, PinyinLineState> = {};` | `@Input() annotationByIndex: Record<number, AnnotationLineState> = {};` |
| `@Input() pinyinEnabled = true;` | `@Input() annotationEnabled = true;` |
| `pinyinFor(index)` method | rename to `annotationFor(index)`; body reads `this.annotationByIndex[index]` and returns `entry.annotation`; keep the comment, s/pinyin/annotation/ |

`lyrics-view.component.html` — replace the annotation span block with:

```html
@if (annotationFor(i)) {
  <span
    class="annotation-line"
    [class.annotation-line--hidden]="!annotationEnabled"
    [attr.aria-hidden]="!annotationEnabled"
    >{{ annotationFor(i) }}</span
  >
}
```

(The `hanzi-line` class on the original-text span stays — it's the original-script line; renaming it adds nothing.)

`lyrics-view.component.scss` — exact replacements everywhere they appear: `pinyin-line` → `annotation-line` (including `--hidden`), `pinyin-in` → `annotation-in` (keyframes name and its `animation:` reference), and update the two comments mentioning pinyin to say "annotation".

`lyrics-view.component.spec.ts` — rename table: `pinyinByIndex` → `annotationByIndex`, `pinyinEnabled` → `annotationEnabled`, `pinyinFor` → `annotationFor`, `pinyin:` field in fixture objects → `annotation:`, CSS selector `.pinyin-line` → `.annotation-line`, `.pinyin-line--hidden` → `.annotation-line--hidden`, type import `PinyinLineState` → `AnnotationLineState` if present.

Run: `yarn nx test web-lyrics-ui-lyrics-view`
Expected: PASS.

- [ ] **Step 8: Migrate the lyrics feature page**

`lyrics.component.ts` — full new content:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LyricsAnnotationStore, LyricsStore } from '@angular-spotify/web/lyrics/data-access';
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
  annotationByIndex$ = this.annotationStore.annotationByIndex$;
  enabled$ = this.annotationStore.enabled$;
  pageStatusText$ = this.annotationStore.pageStatusText$;

  constructor(
    private lyricsStore: LyricsStore,
    private playerApi: PlayerApiService,
    private annotationStore: LyricsAnnotationStore
  ) {}

  onSeekTo(positionMs: number): void {
    this.playerApi.seek(positionMs).subscribe();
  }

  onVisibleRangeChange(range: { start: number; end: number }): void {
    this.annotationStore.setVisibleRange(range);
  }
}
```

`lyrics.component.html` — update the `<as-lyrics-view>` bindings and the pill. The view bindings become:

```html
[annotationByIndex]="(annotationByIndex$ | async) ?? {}"
[annotationEnabled]="(enabled$ | async) ?? false"
```

and the status pill block becomes (the store now emits final copy, so the ternary goes away):

```html
@if (pageStatusText$ | async; as statusText) {
  <div class="annotation-status" role="status" aria-live="polite">
    <span class="annotation-status__dot"></span>
    <span>{{ statusText }}</span>
  </div>
}
```

`lyrics.component.scss` — exact replacements: `pinyin-status` → `annotation-status` (class, `__dot`, and in the reduced-motion block), keyframes `pinyin-status-in` → `annotation-status-in`, `pinyin-status-pulse` → `annotation-status-pulse` (names and their `animation:` references).

Run: `yarn nx test web-lyrics-feature`
Expected: PASS.

- [ ] **Step 9: Full-workspace sanity check (toggle must still compile via the alias)**

Run: `yarn nx run-many --target=test --projects=web-lyrics-data-access,web-lyrics-ui-lyrics-view,web-lyrics-ui-pinyin-toggle,web-lyrics-feature,web-shared-data-access-built-in-ai`
Expected: PASS — the toggle's suite passes unchanged because `PinyinStore` is aliased and its used members (`showToggle$`, `enabled$`, `setEnabled`) kept their names.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(lyrics): PinyinStore → registry-driven LyricsAnnotationStore"
```

---

### Task 5: Generic annotation toggle + now-playing-bar

**Files:**
- Rename (within the `pinyin-toggle` lib — lib folder/alias unchanged by design):
  - `libs/web/lyrics/ui/pinyin-toggle/src/lib/pinyin-toggle.component.ts` → `annotation-toggle.component.ts` (+ `.html`, `.scss`, `.spec.ts`)
  - `libs/web/lyrics/ui/pinyin-toggle/src/lib/pinyin-toggle.module.ts` → `annotation-toggle.module.ts`
- Modify: `libs/web/lyrics/ui/pinyin-toggle/src/index.ts`
- Modify: `libs/web/shell/ui/now-playing-bar/src/lib/now-playing-bar.component.html`, `now-playing-bar.module.ts`
- Modify: `libs/web/lyrics/data-access/src/lib/lyrics-annotation.store.ts` (remove the `PinyinStore` alias)

**Interfaces:**
- Consumes: `LyricsAnnotationStore.activeAnnotator$` / `showToggle$` / `enabled$` / `setEnabled` (Task 4).
- Produces: `AnnotationToggleComponent` (selector `as-annotation-toggle`), `AnnotationToggleModule` — still imported from `@angular-spotify/web/lyrics/ui/pinyin-toggle`.

- [ ] **Step 1: Rename the files**

```bash
cd libs/web/lyrics/ui/pinyin-toggle/src/lib
git mv pinyin-toggle.component.ts annotation-toggle.component.ts
git mv pinyin-toggle.component.html annotation-toggle.component.html
git mv pinyin-toggle.component.scss annotation-toggle.component.scss
git mv pinyin-toggle.component.spec.ts annotation-toggle.component.spec.ts
git mv pinyin-toggle.module.ts annotation-toggle.module.ts
cd -
```

- [ ] **Step 2: Rewrite the spec (failing first)**

Full new content of `annotation-toggle.component.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AnnotationToggleComponent } from './annotation-toggle.component';
import { AnnotatorConfig, LyricsAnnotationStore, ROMAJI_ANNOTATOR, PINYIN_ANNOTATOR } from '@angular-spotify/web/lyrics/data-access';

describe('AnnotationToggleComponent', () => {
  let fixture: ComponentFixture<AnnotationToggleComponent>;
  let component: AnnotationToggleComponent;

  const showToggle$ = new BehaviorSubject<boolean>(true);
  const enabled$ = new BehaviorSubject<boolean>(true);
  const activeAnnotator$ = new BehaviorSubject<AnnotatorConfig | null>(PINYIN_ANNOTATOR);
  const setEnabledSpy = jest.fn();

  const storeMock = {
    showToggle$: showToggle$.asObservable(),
    enabled$: enabled$.asObservable(),
    activeAnnotator$: activeAnnotator$.asObservable(),
    setEnabled: setEnabledSpy
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    showToggle$.next(true);
    enabled$.next(true);
    activeAnnotator$.next(PINYIN_ANNOTATOR);

    await TestBed.configureTestingModule({
      declarations: [AnnotationToggleComponent],
      providers: [{ provide: LyricsAnnotationStore, useValue: storeMock }],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(AnnotationToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with selector as-annotation-toggle', () => {
    expect(component).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cmp = (AnnotationToggleComponent as any)['ɵcmp'];
    expect(cmp.selectors[0][0]).toBe('as-annotation-toggle');
  });

  it('hides the button when showToggle$ is false', () => {
    showToggle$.next(false);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('button'))).toBeNull();
  });

  it('hides the button when there is no active annotator', () => {
    activeAnnotator$.next(null);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('button'))).toBeNull();
  });

  it('renders the pinyin icon for the pinyin annotator', () => {
    fixture.detectChanges();
    const label = fixture.debugElement.query(By.css('.annotation-toggle-label'));
    expect(label.nativeElement.textContent.trim()).toBe('拼');
  });

  it('renders the romaji icon for the romaji annotator', () => {
    activeAnnotator$.next(ROMAJI_ANNOTATOR);
    fixture.detectChanges();
    const label = fixture.debugElement.query(By.css('.annotation-toggle-label'));
    expect(label.nativeElement.textContent.trim()).toBe('あ');
  });

  it('marks the button active when enabled', () => {
    enabled$.next(true);
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('button'));
    expect(btn.nativeElement.classList).toContain('active');
  });

  it('does not mark the button active when disabled', () => {
    enabled$.next(false);
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('button'));
    expect(btn.nativeElement.classList).not.toContain('active');
  });

  it('calls setEnabled with the toggled value on click', () => {
    enabled$.next(true);
    fixture.detectChanges();
    fixture.debugElement.query(By.css('button')).triggerEventHandler('click', null);
    expect(setEnabledSpy).toHaveBeenCalledWith(false);
  });

  it('calls setEnabled(true) when currently disabled', () => {
    enabled$.next(false);
    fixture.detectChanges();
    fixture.debugElement.query(By.css('button')).triggerEventHandler('click', null);
    expect(setEnabledSpy).toHaveBeenCalledWith(true);
  });

  describe('tooltip copy comes from the annotator config', () => {
    it('uses tooltipHide when enabled', () => {
      activeAnnotator$.next(ROMAJI_ANNOTATOR);
      enabled$.next(true);
      fixture.detectChanges();
      expect(ROMAJI_ANNOTATOR.toggle.tooltipHide).toBe('Hide romaji');
    });

    it('uses tooltipShow when disabled', () => {
      activeAnnotator$.next(ROMAJI_ANNOTATOR);
      enabled$.next(false);
      fixture.detectChanges();
      expect(ROMAJI_ANNOTATOR.toggle.tooltipShow).toBe('Show romaji');
    });
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `yarn nx test web-lyrics-ui-pinyin-toggle`
Expected: FAIL — `AnnotationToggleComponent` doesn't exist.

- [ ] **Step 4: Rewrite component, template, styles, module, index**

`annotation-toggle.component.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LyricsAnnotationStore } from '@angular-spotify/web/lyrics/data-access';

@Component({
  selector: 'as-annotation-toggle',
  templateUrl: './annotation-toggle.component.html',
  styleUrls: ['./annotation-toggle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnotationToggleComponent {
  showToggle$ = this.annotationStore.showToggle$;
  isEnabled$ = this.annotationStore.enabled$;
  annotator$ = this.annotationStore.activeAnnotator$;
  private isEnabled = true;

  constructor(private annotationStore: LyricsAnnotationStore) {
    this.isEnabled$.subscribe((v) => (this.isEnabled = v));
  }

  toggle(): void {
    this.annotationStore.setEnabled(!this.isEnabled);
  }
}
```

`annotation-toggle.component.html`:

```html
<ng-container *ngIf="annotator$ | async as annotator">
  <button
    *ngIf="showToggle$ | async"
    nz-tooltip
    [nzTooltipTitle]="
      (isEnabled$ | async) ? annotator.toggle.tooltipHide : annotator.toggle.tooltipShow
    "
    class="annotation-toggle-btn"
    [class.active]="isEnabled$ | async"
    (click)="toggle()"
  >
    <span class="annotation-toggle-label">{{ annotator.toggle.icon }}</span>
  </button>
</ng-container>
```

`annotation-toggle.component.scss` (rename of the existing classes, styles unchanged):

```scss
.annotation-toggle-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.7;
  padding: 0;

  &:hover,
  &.active {
    opacity: 1;
  }
}

.annotation-toggle-label {
  font-size: 18px;
  line-height: 1;
  user-select: none;
}
```

`annotation-toggle.module.ts`:

```ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { AnnotationToggleComponent } from './annotation-toggle.component';

@NgModule({
  imports: [CommonModule, NzToolTipModule],
  declarations: [AnnotationToggleComponent],
  exports: [AnnotationToggleComponent]
})
export class AnnotationToggleModule {}
```

`libs/web/lyrics/ui/pinyin-toggle/src/index.ts`:

```ts
export * from './lib/annotation-toggle.component';
export * from './lib/annotation-toggle.module';
```

- [ ] **Step 5: Update now-playing-bar**

In `now-playing-bar.module.ts`: `PinyinToggleModule` → `AnnotationToggleModule` (import path stays `@angular-spotify/web/lyrics/ui/pinyin-toggle`), in both the import statement and the `imports:` array.
In `now-playing-bar.component.html`: `<as-pinyin-toggle></as-pinyin-toggle>` → `<as-annotation-toggle></as-annotation-toggle>`.

- [ ] **Step 6: Remove the temporary alias**

In `lyrics-annotation.store.ts` delete the final line:

```ts
export { LyricsAnnotationStore as PinyinStore };
```

Then verify nothing references it: `grep -rn "PinyinStore\|PinyinToggle\|pinyinByIndex\|pinyinFor\|PinyinLineState\|pinyin.models\|pinyin.store" libs apps --include="*.ts" --include="*.html"` — expected: no matches.

- [ ] **Step 7: Run affected suites**

Run: `yarn nx run-many --target=test --projects=web-lyrics-ui-pinyin-toggle,web-shell-ui-now-playing-bar,web-lyrics-data-access`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(lyrics): config-driven annotation toggle (拼/あ) in now-playing bar"
```

---

### Task 6: Whole-workspace verification

**Files:** none (verification only; fix anything it surfaces).

- [ ] **Step 1: Full test run**

Run: `yarn nx run-many --target=test --all`
Expected: PASS across all projects.

- [ ] **Step 2: Lint**

Run: `yarn nx run-many --target=lint --projects=web-lyrics-data-access,web-lyrics-ui-lyrics-view,web-lyrics-ui-pinyin-toggle,web-lyrics-feature,web-shared-data-access-built-in-ai,web-shell-ui-now-playing-bar`
Expected: clean.

- [ ] **Step 3: Production build**

Run: `yarn nx build angular-spotify`
Expected: build succeeds.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "test(lyrics): whole-workspace verification fixes for annotation refactor"
```

(Skip the commit if nothing changed.)

---

### Task 7: Live browser verification (Playwriter)

Automated tests mock the AI APIs, so per repo CLAUDE.md this must be verified in real Chrome (a build with built-in AI / Gemini Nano enabled, logged-in Spotify session).

**Files:**
- Create: `docs/screenshots/romaji-lyrics.png` (demo screenshot)

- [ ] **Step 1: Start the dev server**

Run: `yarn start` (background). Wait for compilation, then open **http://127.0.0.1:4200/** via Playwriter (never `localhost` — OAuth whitelist).

- [ ] **Step 2: Pinyin regression check (zh)**

Play a Mandopop track with lyrics (e.g. 周杰倫 or the previously used 練習), open the lyrics page. Verify: 拼 toggle appears in the now-playing bar once pinyin renders; tone-marked pinyin lines render above hanzi; toggling hides/shows them; console has no errors.

- [ ] **Step 3: Romaji verification (ja)**

Play a J-pop track with Japanese lyrics (e.g. YOASOBI「夜に駆ける」or Kenshi Yonezu「Lemon」). Verify: page pill shows "Preparing romaji…" (or "Downloading language model…" on first ja model fetch); あ toggle appears; Hepburn romaji renders above each Japanese line including kana-only lines; toggle tooltips read "Hide romaji"/"Show romaji"; toggling animates hide/show; console clean.

- [ ] **Step 4: Non-CJK silence check**

Play an English track: no toggle, no pill, no console errors.

- [ ] **Step 5: Capture screenshot**

Screenshot the romaji lyrics view to `docs/screenshots/romaji-lyrics.png` (match the framing of the existing `docs/screenshots/pinyin-lyrics-on.png`).

- [ ] **Step 6: Commit**

```bash
git add docs/screenshots/romaji-lyrics.png
git commit -m "docs(lyrics): romaji lyrics demo screenshot"
```

---

## PR notes (for the finishing step, not a task)

PR base: `main`. Per CLAUDE.md the PR description must include a Mermaid diagram of the feature — reuse the architecture diagram from the spec (`docs/superpowers/specs/2026-07-13-lyrics-annotation-design.md`) and embed the pinyin-regression + romaji screenshots.
