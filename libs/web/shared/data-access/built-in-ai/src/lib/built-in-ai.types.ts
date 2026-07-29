export type AiAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

export interface LanguageDetectionResult {
  lang: string;
  confidence: number;
}

export interface DetectorInstance {
  detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]>;
}

export interface AnnotationSession {
  prompt(input: string, opts?: { signal?: AbortSignal }): Promise<string>;
  destroy(): void;
}

export interface CreateSessionOptions {
  onDownloadProgress?: (loaded: number) => void;
  signal?: AbortSignal;
}

/** What a prompt-based annotator needs from the Prompt API. */
export interface PromptEngineSpec {
  /** Annotator id — cache key; one base session lives per id. */
  id: string;
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

// Minimal ambient typings for Chrome's global built-in AI APIs.
declare global {
  // eslint-disable-next-line no-var
  var LanguageModel:
    | {
        availability(options?: { languages: string[] }): Promise<AiAvailability>;
        create(options?: {
          initialPrompts?: { role: 'system' | 'user'; content: string }[];
          monitor?: (m: {
            addEventListener(
              type: 'downloadprogress',
              cb: (e: { loaded: number }) => void
            ): void;
          }) => void;
          signal?: AbortSignal;
        }): Promise<AnnotationSession>;
      }
    | undefined;

  // eslint-disable-next-line no-var
  var LanguageDetector:
    | {
        availability(): Promise<AiAvailability>;
        create(): Promise<DetectorInstance>;
      }
    | undefined;
}
