import { Injectable } from '@angular/core';
import {
  AiAvailability,
  AnnotationEngine,
  AnnotationSession,
  CreateSessionOptions,
  DetectorInstance,
  LanguageDetectionResult,
  PromptEngineSpec
} from './built-in-ai.types';

@Injectable({ providedIn: 'root' })
export class BuiltInAiService {
  /** One detector for the app's lifetime; cleared on failure so the next call retries. */
  private detector: Promise<DetectorInstance> | null = null;

  /** One engine (and base session) per annotator id, kept for the app's lifetime. */
  private engines = new Map<string, AnnotationEngine>();

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
    const t0 = performance.now();
    let detector: DetectorInstance;
    try {
      if (!this.detector) {
        this.detector = globalThis.LanguageDetector!.create();
      }
      detector = await this.detector;
    } catch {
      this.detector = null;
      return null;
    }
    try {
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
