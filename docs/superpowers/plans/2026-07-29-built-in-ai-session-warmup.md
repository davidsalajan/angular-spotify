# Built-in AI Session Warm-up and Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Chrome built-in AI usage follow Chrome's dos-and-don'ts: reuse the language detector, cache one base session per annotator for the app's lifetime, clone the base session per batch, and start session creation the moment the annotator is matched instead of at first drain.

**Architecture:** All session lifecycle logic lives in `BuiltInAiService` (`libs/web/shared/data-access/built-in-ai`). The service caches engines in a `Map` keyed by annotator id; each engine memoizes its in-flight session creation and runs every batch on a throwaway clone. `LyricsAnnotationStore` (`libs/web/lyrics/data-access`) gains a `prepareEngine` helper called both from `detectAndSeed` (warm-up) and `drainQueue`, and its `reset()` stops destroying sessions.

**Tech Stack:** Angular 12 / Nx monorepo, @ngrx/component-store, Jest, Chrome built-in AI (`LanguageModel`, `LanguageDetector` globals).

**Spec:** `docs/superpowers/specs/2026-07-29-built-in-ai-session-warmup-design.md`

## Global Constraints

- Do NOT create any session at app start: `LanguageModel.create()` can trigger a multi-GB model download. Sessions are created only after an annotator is matched, availability is confirmed, and at least one line qualifies.
- Annotator ids in the registry are `'pinyin'` and `'romaji'` (`libs/web/lyrics/data-access/src/lib/annotators/`).
- Keep the existing `console.log('[BuiltInAI] ...')` timing lines — browser verification reads them.
- Test commands: `yarn nx test web-shared-data-access-built-in-ai` and `yarn nx test web-lyrics-data-access` (run from repo root; `.nvmrc` pins Node 18).
- Work happens on branch `feat/ai-session-warmup`.

---

### Task 1: Detector reuse in BuiltInAiService

`detectLanguage()` currently calls `LanguageDetector.create()` on every track. Cache the creation promise; clear it on failure so the next call retries.

**Files:**
- Modify: `libs/web/shared/data-access/built-in-ai/src/lib/built-in-ai.types.ts`
- Modify: `libs/web/shared/data-access/built-in-ai/src/lib/built-in-ai.service.ts:32-46`
- Test: `libs/web/shared/data-access/built-in-ai/src/lib/built-in-ai.service.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `DetectorInstance` exported from `built-in-ai.types.ts`; `detectLanguage(text: string): Promise<LanguageDetectionResult | null>` keeps its signature but reuses one detector.

- [ ] **Step 1: Write the failing tests**

Add to the `BuiltInAiService — detection` describe block in `built-in-ai.service.spec.ts`:

```ts
it('detectLanguage reuses one detector across calls', async () => {
  const detect = jest.fn().mockResolvedValue([{ detectedLanguage: 'zh', confidence: 0.9 }]);
  const create = jest.fn().mockResolvedValue({ detect });
  (globalThis as any).LanguageDetector = { create };
  await service.detectLanguage('你好');
  await service.detectLanguage('再见');
  expect(create).toHaveBeenCalledTimes(1);
  expect(detect).toHaveBeenCalledTimes(2);
});

it('detectLanguage retries detector creation after a failure', async () => {
  const detect = jest.fn().mockResolvedValue([{ detectedLanguage: 'zh', confidence: 0.9 }]);
  const create = jest
    .fn()
    .mockRejectedValueOnce(new Error('boom'))
    .mockResolvedValue({ detect });
  (globalThis as any).LanguageDetector = { create };
  expect(await service.detectLanguage('你好')).toBeNull();
  expect(await service.detectLanguage('你好')).toEqual({ lang: 'zh', confidence: 0.9 });
  expect(create).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn nx test web-shared-data-access-built-in-ai -t "detectLanguage reuses"`
Expected: FAIL — `create` called 2 times (no caching yet). The retry test passes incidentally; the reuse test must fail.

- [ ] **Step 3: Implement detector caching**

In `built-in-ai.types.ts`, add the exported interface and use it in the ambient typing:

```ts
export interface DetectorInstance {
  detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>;
}
```

and change the ambient `LanguageDetector` declaration's `create` to:

```ts
create(): Promise<DetectorInstance>;
```

In `built-in-ai.service.ts`, add a field and rewrite `detectLanguage`:

```ts
/** One detector for the app's lifetime; cleared on failure so the next call retries. */
private detector: Promise<DetectorInstance> | null = null;

async detectLanguage(text: string): Promise<LanguageDetectionResult | null> {
  if (!this.isDetectorAvailable()) {
    return null;
  }
  try {
    const t0 = performance.now();
    if (!this.detector) {
      this.detector = globalThis.LanguageDetector!.create();
    }
    const detector = await this.detector;
    const results = await detector.detect(text);
    console.log(`[BuiltInAI] detectLanguage: ${(performance.now() - t0).toFixed(1)}ms`);
    const top = results[0];
    return top ? { lang: top.detectedLanguage, confidence: top.confidence } : null;
  } catch {
    this.detector = null;
    return null;
  }
}
```

Import `DetectorInstance` in the service's import list from `./built-in-ai.types`.

- [ ] **Step 4: Run the suite to verify it passes**

Run: `yarn nx test web-shared-data-access-built-in-ai`
Expected: PASS, including the two new tests.

- [ ] **Step 5: Commit**

```bash
git add libs/web/shared/data-access/built-in-ai
git commit -m "perf(built-in-ai): reuse one LanguageDetector across tracks"
```

---

### Task 2: Engine cache keyed by annotator id

Rename `createPromptEngine` to `getPromptEngine`, back it with a `Map<string, AnnotationEngine>` keyed by a new `PromptEngineSpec.id`, and pass the annotator id from the store. This task is the rename + cache only; engine internals change in Task 3.

**Files:**
- Modify: `libs/web/shared/data-access/built-in-ai/src/lib/built-in-ai.types.ts:19-22`
- Modify: `libs/web/shared/data-access/built-in-ai/src/lib/built-in-ai.service.ts:83-107`
- Modify: `libs/web/lyrics/data-access/src/lib/lyrics-annotation.store.ts:194-206`
- Test: `libs/web/shared/data-access/built-in-ai/src/lib/built-in-ai.service.spec.ts`
- Test: `libs/web/lyrics/data-access/src/lib/lyrics-annotation.store.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `PromptEngineSpec` gains `id: string`; `getPromptEngine(spec: PromptEngineSpec): AnnotationEngine` replaces `createPromptEngine` and returns the cached engine for a repeated id. Task 4's store mocks emulate this identity (same id → same engine).

- [ ] **Step 1: Write the failing test**

Add to the `BuiltInAiService — generic annotation API` describe block:

```ts
it('getPromptEngine returns the same engine for the same id and a new one per id', () => {
  (globalThis as any).LanguageModel = { create: jest.fn() };
  const a = service.getPromptEngine({ id: 'pinyin', systemPrompt: 'S', batchInstruction: 'I' });
  const b = service.getPromptEngine({ id: 'pinyin', systemPrompt: 'S', batchInstruction: 'I' });
  const c = service.getPromptEngine({ id: 'romaji', systemPrompt: 'S2', batchInstruction: 'I2' });
  expect(b).toBe(a);
  expect(c).not.toBe(a);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn nx test web-shared-data-access-built-in-ai -t "getPromptEngine returns the same engine"`
Expected: FAIL — `service.getPromptEngine is not a function`.

- [ ] **Step 3: Implement the cache**

In `built-in-ai.types.ts`:

```ts
/** What a prompt-based annotator needs from the Prompt API. */
export interface PromptEngineSpec {
  /** Annotator id — cache key; one base session lives per id. */
  id: string;
  systemPrompt: string;
  batchInstruction: string;
}
```

In `built-in-ai.service.ts`, add a field, rename the public method, and keep the engine body as a private builder (unchanged internals for now):

```ts
/** One engine (and base session) per annotator id, kept for the app's lifetime. */
private engines = new Map<string, AnnotationEngine>();

/**
 * The Prompt API engine for one annotator. Cached by spec.id: the base
 * session survives track changes, so the second song in the same language
 * starts warm.
 */
getPromptEngine(spec: PromptEngineSpec): AnnotationEngine {
  let engine = this.engines.get(spec.id);
  if (!engine) {
    engine = this.buildPromptEngine(spec);
    this.engines.set(spec.id, engine);
  }
  return engine;
}

private buildPromptEngine(spec: PromptEngineSpec): AnnotationEngine {
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
```

In `lyrics-annotation.store.ts`, update `createEngineFor`:

```ts
private createEngineFor(config: AnnotatorConfig): AnnotationEngine {
  switch (config.kind) {
    // 'prompt' is the only engine today; a future 'translator' kind adds a
    // case here without touching the drain machinery.
    case 'prompt':
      return this.ai.getPromptEngine({
        id: config.id,
        systemPrompt: config.systemPrompt,
        batchInstruction: config.batchInstruction
      });
    default:
      throw new Error(`No annotation engine for kind: ${config.kind as string}`);
  }
}
```

- [ ] **Step 4: Update existing tests for the rename**

In `built-in-ai.service.spec.ts`, the three `createPromptEngine` tests become `getPromptEngine` calls. Give each test its own id so nothing shares a cache entry:

- `createPromptEngine creates the session once...` → `service.getPromptEngine({ id: 't-once', systemPrompt: 'SYS', batchInstruction: 'INSTR' })`
- `createPromptEngine.destroy destroys...` → `service.getPromptEngine({ id: 't-destroy', systemPrompt: 'SYS', batchInstruction: 'I' })`
- `createPromptEngine.annotateBatch rejects...` → `service.getPromptEngine({ id: 't-notready', systemPrompt: 'SYS', batchInstruction: 'I' })`

Rename the test descriptions from `createPromptEngine...` to `getPromptEngine...` to match.

In `lyrics-annotation.store.spec.ts`, replace every `createPromptEngine` mock key and assertion with `getPromptEngine` (the `ai` mock objects in all four describe blocks, plus assertions in `activates romaji for Japanese lyrics`, `checks availability...`, `stays silent when detection matches an annotator but no lines qualify`, and `createPromptEngine is called once even with multiple drains` — rename that test to `getPromptEngine is called once even with multiple drains` for now; Task 4 rewrites it).

- [ ] **Step 5: Run both suites to verify they pass**

Run: `yarn nx test web-shared-data-access-built-in-ai && yarn nx test web-lyrics-data-access`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/web/shared/data-access/built-in-ai libs/web/lyrics/data-access
git commit -m "perf(built-in-ai): cache one prompt engine per annotator id"
```

---

### Task 3: Concurrent-safe ensureReady and clone-per-batch

Engine internals: memoize the in-flight session creation so the warm-up call and `drainQueue` share one `LanguageModel.create()`, and run each batch on a clone of the base session so batches never pollute the base context.

**Files:**
- Modify: `libs/web/shared/data-access/built-in-ai/src/lib/built-in-ai.types.ts:8-11` (and the ambient `LanguageModel.create` return type stays `Promise<AnnotationSession>` — only the interface gains `clone`)
- Modify: `libs/web/shared/data-access/built-in-ai/src/lib/built-in-ai.service.ts` (the `buildPromptEngine` body from Task 2)
- Test: `libs/web/shared/data-access/built-in-ai/src/lib/built-in-ai.service.spec.ts`

**Interfaces:**
- Consumes: `buildPromptEngine`/`getPromptEngine` from Task 2.
- Produces: `AnnotationSession` gains `clone(opts?: { signal?: AbortSignal }): Promise<AnnotationSession>`. `AnnotationEngine`'s public signature is unchanged — Task 4 relies on `ensureReady` being safe to call twice concurrently.

- [ ] **Step 1: Write the failing tests**

Add a helper and four tests to the `BuiltInAiService — generic annotation API` describe block:

```ts
const fakeCloneableSession = (output: string) => {
  const clone = {
    prompt: jest.fn().mockResolvedValue(output),
    destroy: jest.fn(),
    clone: jest.fn()
  };
  const base = {
    prompt: jest.fn(),
    destroy: jest.fn(),
    clone: jest.fn().mockResolvedValue(clone)
  };
  return { base, clone };
};

it('concurrent ensureReady calls share a single session creation', async () => {
  const { base } = fakeCloneableSession('[]');
  let resolveCreate!: (s: unknown) => void;
  const create = jest.fn().mockReturnValue(new Promise((r) => (resolveCreate = r)));
  (globalThis as any).LanguageModel = { create };
  const engine = service.getPromptEngine({ id: 't-conc', systemPrompt: 'S', batchInstruction: 'I' });
  const first = engine.ensureReady();
  const second = engine.ensureReady();
  resolveCreate(base);
  await Promise.all([first, second]);
  expect(create).toHaveBeenCalledTimes(1);
});

it('a failed session creation is retried by the next ensureReady', async () => {
  const { base } = fakeCloneableSession('[]');
  const create = jest
    .fn()
    .mockRejectedValueOnce(new Error('boom'))
    .mockResolvedValue(base);
  (globalThis as any).LanguageModel = { create };
  const engine = service.getPromptEngine({ id: 't-retry', systemPrompt: 'S', batchInstruction: 'I' });
  await expect(engine.ensureReady()).rejects.toThrow('boom');
  await engine.ensureReady();
  expect(create).toHaveBeenCalledTimes(2);
});

it('annotateBatch prompts a clone and destroys it, never the base session', async () => {
  const { base, clone } = fakeCloneableSession('["nǐ hǎo"]');
  (globalThis as any).LanguageModel = { create: jest.fn().mockResolvedValue(base) };
  const engine = service.getPromptEngine({ id: 't-clone', systemPrompt: 'S', batchInstruction: 'I' });
  await engine.ensureReady();
  const result = await engine.annotateBatch(['你好']);
  expect(result).toEqual(['nǐ hǎo']);
  expect(base.clone).toHaveBeenCalled();
  expect((clone.prompt as jest.Mock).mock.calls[0][0]).toBe('I\n\n你好');
  expect(base.prompt).not.toHaveBeenCalled();
  expect(clone.destroy).toHaveBeenCalled();
  expect(base.destroy).not.toHaveBeenCalled();
});

it('annotateBatch destroys the clone even when the prompt fails', async () => {
  const { base, clone } = fakeCloneableSession('[]');
  (clone.prompt as jest.Mock).mockRejectedValue(new Error('AI error'));
  (globalThis as any).LanguageModel = { create: jest.fn().mockResolvedValue(base) };
  const engine = service.getPromptEngine({ id: 't-cfail', systemPrompt: 'S', batchInstruction: 'I' });
  await engine.ensureReady();
  await expect(engine.annotateBatch(['你好'])).rejects.toThrow('AI error');
  expect(clone.destroy).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn nx test web-shared-data-access-built-in-ai -t "clone"`
Expected: FAIL — `annotateBatch` prompts the base session directly; `base.clone` never called. (TypeScript may fail first on the missing `clone` in `AnnotationSession` — that is the same failure surface.)

- [ ] **Step 3: Implement**

In `built-in-ai.types.ts`:

```ts
export interface AnnotationSession {
  prompt(input: string, opts?: { signal?: AbortSignal }): Promise<string>;
  clone(opts?: { signal?: AbortSignal }): Promise<AnnotationSession>;
  destroy(): void;
}
```

In `built-in-ai.service.ts`, replace `buildPromptEngine`'s body:

```ts
private buildPromptEngine(spec: PromptEngineSpec): AnnotationEngine {
  let session: AnnotationSession | null = null;
  let creating: Promise<void> | null = null;
  return {
    // Memoizes the in-flight creation: the detectAndSeed warm-up and the
    // first drain both land here and share one LanguageModel.create().
    ensureReady: (opts: CreateSessionOptions = {}) => {
      if (session) {
        return Promise.resolve();
      }
      if (!creating) {
        creating = this.createSession(spec.systemPrompt, opts).then(
          (s) => {
            session = s;
            creating = null;
          },
          (err) => {
            creating = null;
            throw err;
          }
        );
      }
      return creating;
    },
    // Each batch runs on a throwaway clone so the base session keeps only
    // the system prompt — batches never accumulate as context.
    annotateBatch: async (lines: string[], signal?: AbortSignal) => {
      if (!session) {
        throw new Error('Annotation engine not ready');
      }
      const clone = await session.clone({ signal });
      try {
        return await this.promptBatch(clone, spec.batchInstruction, lines, signal);
      } finally {
        clone.destroy();
      }
    },
    destroy: () => {
      session?.destroy();
      session = null;
      creating = null;
    }
  };
}
```

- [ ] **Step 4: Update the two engine tests that prompt directly**

The Task 2 versions of `getPromptEngine creates the session once...` and `getPromptEngine.destroy destroys...` use `fakeSession`, which has no `clone`. Switch them to `fakeCloneableSession`:

```ts
it('getPromptEngine creates the session once across ensureReady calls and prompts with the spec', async () => {
  const { base, clone } = fakeCloneableSession('["kimi no"]');
  const create = jest.fn().mockResolvedValue(base);
  (globalThis as any).LanguageModel = { create };
  const engine = service.getPromptEngine({ id: 't-once', systemPrompt: 'SYS', batchInstruction: 'INSTR' });
  await engine.ensureReady();
  await engine.ensureReady();
  expect(create).toHaveBeenCalledTimes(1);
  const result = await engine.annotateBatch(['君の']);
  expect(result).toEqual(['kimi no']);
  expect((clone.prompt as jest.Mock).mock.calls[0][0]).toBe('INSTR\n\n君の');
});

it('getPromptEngine.destroy destroys the session and allows a fresh one', async () => {
  const { base } = fakeCloneableSession('[]');
  const create = jest.fn().mockResolvedValue(base);
  (globalThis as any).LanguageModel = { create };
  const engine = service.getPromptEngine({ id: 't-destroy', systemPrompt: 'SYS', batchInstruction: 'I' });
  await engine.ensureReady();
  engine.destroy();
  expect(base.destroy).toHaveBeenCalled();
  await engine.ensureReady();
  expect(create).toHaveBeenCalledTimes(2);
});
```

The `fakeSession` helper stays — `createSession` and `promptBatch` tests still use it, and `promptBatch` still takes any session directly.

- [ ] **Step 5: Run both suites to verify they pass**

Run: `yarn nx test web-shared-data-access-built-in-ai && yarn nx test web-lyrics-data-access`
Expected: PASS. (The lyrics store spec's `makeEngine` mock implements `AnnotationEngine`, whose signature did not change.)

- [ ] **Step 6: Commit**

```bash
git add libs/web/shared/data-access/built-in-ai
git commit -m "perf(built-in-ai): memoize session creation, clone base session per batch"
```

---

### Task 4: Store warms at detection; reset stops destroying

Extract a `prepareEngine(gen, config)` helper used by both `detectAndSeed` (fire-and-forget warm-up) and `drainQueue` (awaited). `reset()` drops the engine reference without destroying — the base session lives in the service cache. The stale-generation guard stops destroying too: engines are keyed by annotator id, so a wrong-language session can never be adopted.

**Files:**
- Modify: `libs/web/lyrics/data-access/src/lib/lyrics-annotation.store.ts:112-158` (detectAndSeed), `:208-231` (drainQueue engine block), `:283-298` (reset)
- Test: `libs/web/lyrics/data-access/src/lib/lyrics-annotation.store.spec.ts`

**Interfaces:**
- Consumes: `getPromptEngine` identity semantics from Task 2 (same id → same engine) and idempotent `ensureReady` from Task 3.
- Produces: no public API changes; behavior only.

- [ ] **Step 1: Write the failing tests**

In the `LyricsAnnotationStore — detection gating` describe block, add:

```ts
it('warms the session as soon as the annotator is matched, before any drain', async () => {
  store.init([{ time: 0, text: '你好' }]);
  await flush();
  expect(ai.getPromptEngine).toHaveBeenCalledWith(expect.objectContaining({ id: 'pinyin' }));
  expect(engine.ensureReady).toHaveBeenCalled();
  expect(engine.annotateBatch).not.toHaveBeenCalled();
});
```

In the `LyricsAnnotationStore — track change` describe block, rewrite the first test:

```ts
it('resets state but keeps the base session alive when the track changes', async () => {
  lyrics$.next(lines(10, 'a'));
  await flush();
  store.setActiveLine(0);
  await flush(); await flush();
  expect(read<Record<number, any>>(store.annotationByIndex$)[0].status).toBe('done');

  lyrics$.next(lines(10, 'b'));
  await flush();
  expect(engine.destroy).not.toHaveBeenCalled();
  const map = read<Record<number, any>>(store.annotationByIndex$);
  expect(map[0].status).toBe('pending'); // fresh seed for new track
  expect(map[0].text).toBe('b0汉');
});
```

Rewrite `destroys an engine whose preparation finishes after a track change instead of adopting it` — the cache makes wrong-language adoption structurally impossible, and nothing is destroyed anymore. The mock must emulate the service cache (same id → same engine), not `mockReturnValueOnce` sequencing:

```ts
it('does not adopt (or destroy) an engine whose preparation finishes after a track change', async () => {
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
  ai.getPromptEngine.mockImplementation((spec: { id: string }) =>
    spec.id === 'romaji' ? engineB : engineA
  );

  lyrics$.next(lines(3, 'a'));            // zh track; warm-up starts, engineA pending
  await flush();
  store.setActiveLine(0);                  // drain also waits on engineA
  await flush();

  ai.detectLanguage.mockResolvedValueOnce({ lang: 'ja', confidence: 0.9 });
  lyrics$.next([{ time: 0, text: 'ありがとう' }]);  // ja track before engineA is ready
  await flush();

  resolveReady();                          // stale zh preparation finishes late
  await flush();
  store.setActiveLine(0);
  await flush();
  await flush();

  expect(engineA.destroy).not.toHaveBeenCalled();   // base session survives for the next zh track
  expect(engineA.annotateBatch).not.toHaveBeenCalled();
  expect(engineB.annotateBatch).toHaveBeenCalled();  // ja track uses its own engine
});
```

In `does not write stale results into new track state when drain resolves after track change`, delete the line `expect(engine.destroy).toHaveBeenCalled();` (and the comment above it) — the stale-write assertions below it are the point and stay.

In the `LyricsAnnotationStore — windowing, queue, cache` describe block, rewrite `passes onDownloadProgress to ensureReady and progress callback flips downloadState to downloading`. The old version arms `mockImplementationOnce` after `beforeEach`, but warm-up now consumes `ensureReady` during `beforeEach`'s `init`, so that `Once` implementation would never run. Inspect the warm-up call instead:

```ts
it('passes onDownloadProgress to ensureReady and progress callback flips downloadState to downloading', async () => {
  // Warm-up in beforeEach's init() already called ensureReady — inspect that call.
  const capturedOpts = engine.ensureReady.mock.calls[0]?.[0] as
    | { onDownloadProgress?: () => void }
    | undefined;
  expect(typeof capturedOpts?.onDownloadProgress).toBe('function');
  // downloadState is 'ready' after the warm-up completed; invoking the
  // progress callback should flip it back to 'downloading'.
  capturedOpts?.onDownloadProgress?.();
  let state!: string;
  store.downloadState$.pipe(take(1)).subscribe((s) => (state = s));
  expect(state).toBe('downloading');
});
```

Rewrite `getPromptEngine is called once even with multiple drains` (warm-up adds a legitimate second acquisition; the identity guarantee lives in the service cache now):

```ts
it('every engine acquisition uses the annotator id, so the service cache dedupes', async () => {
  engine.annotateBatch.mockResolvedValue(Array(8).fill('pīn yīn'));
  store.setActiveLine(0);
  await flush();
  await flush();
  store.setActiveLine(5);
  await flush();
  await flush();
  expect(ai.getPromptEngine.mock.calls.length).toBeGreaterThan(0);
  expect(ai.getPromptEngine.mock.calls.every((c: any[]) => c[0].id === 'pinyin')).toBe(true);
});
```

- [ ] **Step 2: Run the store suite to verify the new tests fail**

Run: `yarn nx test web-lyrics-data-access`
Expected: FAIL —
- `warms the session...`: `engine.ensureReady` not called (no warm-up yet).
- `resets state but keeps the base session alive...`: `engine.destroy` WAS called (reset still destroys).
- `does not adopt (or destroy)...`: `engineA.destroy` WAS called.
- `passes onDownloadProgress...` (rewritten): `ensureReady.mock.calls[0]` is undefined — no warm-up call happened during `init`.

- [ ] **Step 3: Implement in `lyrics-annotation.store.ts`**

Add the helper (place it next to `createEngineFor`):

```ts
/**
 * Acquire and prepare the engine for this generation. Called fire-and-forget
 * from detectAndSeed (warm-up, per Chrome's "create the session when intent
 * is clear") and awaited from drainQueue; the service memoizes the in-flight
 * creation so both share one LanguageModel.create(). Returns false when
 * reset() fired while preparing — the engine is NOT adopted, but never
 * destroyed either: base sessions live in the service cache keyed by
 * annotator id, so a same-language track later starts warm and a
 * wrong-language track can't receive it by construction.
 */
private async prepareEngine(gen: number, config: AnnotatorConfig): Promise<boolean> {
  if (!this.engine) {
    const engine = this.createEngineFor(config);
    this.patchState({ downloadState: 'downloading' });
    await engine.ensureReady({
      onDownloadProgress: () => this.patchState({ downloadState: 'downloading' })
    });
    if (gen !== this.generation) {
      return false;
    }
    this.engine = engine;
    this.patchState({ downloadState: 'ready' });
  }
  return gen === this.generation;
}
```

In `detectAndSeed`, right after the `this.patchState({ support: 'supported', activeAnnotatorId: config.id, annotationByIndex });` line, add:

```ts
// Warm the session now — annotator matched, availability confirmed, lines
// qualify — so the model spins up in parallel with the window seeding below.
void this.prepareEngine(gen, config).catch(() => undefined);
```

In `drainQueue`, replace the whole `if (!this.engine) { ... }` block (the one that creates the engine, patches download state, and destroys on stale generation) with:

```ts
if (!(await this.prepareEngine(gen, config))) {
  return;
}
const engine = this.engine;
if (!engine) {
  return;
}
```

(the existing `const engine = this.engine;` line below the old block is replaced by this; the `while` loop that follows is unchanged).

In `reset()`, replace:

```ts
this.engine?.destroy();
this.engine = null;
```

with:

```ts
// Drop the reference only — the base session stays cached in
// BuiltInAiService so the next same-language track starts warm.
this.engine = null;
```

- [ ] **Step 4: Run both suites to verify they pass**

Run: `yarn nx test web-lyrics-data-access && yarn nx test web-shared-data-access-built-in-ai`
Expected: PASS, all describe blocks. Pay attention to the pre-existing tests that must still pass unchanged: `reports "downloading" while the model is being fetched` (warm-up now triggers the downloading state even before `setActiveLine` — the assertion still holds), `hides the toggle and reports "preparing"...` (warm-up completes, `downloadState` becomes `ready`, preparing label still shows), and both stale-write guards.

- [ ] **Step 5: Commit**

```bash
git add libs/web/lyrics/data-access
git commit -m "perf(lyrics): warm annotation session at detection, keep base sessions across tracks"
```

---

### Task 5: Full verification

**Files:** none created; verification only.

**Interfaces:**
- Consumes: everything above.
- Produces: evidence for the PR (test output, browser timings).

- [ ] **Step 1: Run the affected test suites and lint**

```bash
yarn nx test web-shared-data-access-built-in-ai
yarn nx test web-lyrics-data-access
yarn nx lint web-shared-data-access-built-in-ai
yarn nx lint web-lyrics-data-access
```

Expected: all PASS. Fix anything that fails before proceeding.

- [ ] **Step 2: Verify in a real browser**

Automated tests mock Chrome's AI globals, so per `CLAUDE.md` this must be verified live. Requires Chrome with built-in AI (Gemini Nano) enabled and a logged-in Spotify session.

1. `yarn start`, then open **http://127.0.0.1:4200/** (not `localhost` — OAuth whitelist).
2. Drive Chrome via the playwriter skill (connects to the user's existing Chrome).
3. Play a Chinese song, open lyrics. Expect console: one `[BuiltInAI] createSession: ...ms` and `[BuiltInAI] detectLanguage: ...ms`; pinyin renders above lines.
4. Play a second Chinese song. Expect: NO new `[BuiltInAI] createSession` line (warm start — the cached base session was reused), annotations render, and `detectLanguage` is faster (detector reused).
5. Play a Japanese song. Expect: one new `createSession` (romaji engine, separate cache entry); romaji renders.
6. Return to a Chinese song. Expect: still no new `createSession` — the pinyin base session survived the ja detour.
7. Confirm long-song behavior: batches keep succeeding late into a song (clone-per-batch keeps the base context flat).

- [ ] **Step 3: Report**

Summarize test results and the observed console timings (song-1 cold vs song-2 warm) for the PR description. The PR must include the Mermaid session-lifecycle diagram from the spec (`docs/superpowers/specs/2026-07-29-built-in-ai-session-warmup-design.md`).
