import { BuiltInAiService } from './built-in-ai.service';
import { AnnotationSession } from './built-in-ai.types';

describe('BuiltInAiService — detection', () => {
  let service: BuiltInAiService;

  afterEach(() => {
    (globalThis as any).LanguageModel = undefined;
    (globalThis as any).LanguageDetector = undefined;
  });

  beforeEach(() => {
    service = new BuiltInAiService();
  });

  it('isPromptApiAvailable reflects the global', () => {
    (globalThis as any).LanguageModel = undefined;
    expect(service.isPromptApiAvailable()).toBe(false);
    (globalThis as any).LanguageModel = { availability: jest.fn(), create: jest.fn() };
    expect(service.isPromptApiAvailable()).toBe(true);
  });

  it('isDetectorAvailable reflects the global', () => {
    (globalThis as any).LanguageDetector = undefined;
    expect(service.isDetectorAvailable()).toBe(false);
    (globalThis as any).LanguageDetector = { availability: jest.fn(), create: jest.fn() };
    expect(service.isDetectorAvailable()).toBe(true);
  });

  it('detectLanguage returns the top result mapped to {lang, confidence}', async () => {
    const detect = jest.fn().mockResolvedValue([
      { detectedLanguage: 'zh', confidence: 0.92 },
      { detectedLanguage: 'en', confidence: 0.05 }
    ]);
    (globalThis as any).LanguageDetector = { create: jest.fn().mockResolvedValue({ detect }) };
    const result = await service.detectLanguage('你好');
    expect(result).toEqual({ lang: 'zh', confidence: 0.92 });
  });

  it('detectLanguage returns null when the detector is unavailable', async () => {
    (globalThis as any).LanguageDetector = undefined;
    expect(await service.detectLanguage('你好')).toBeNull();
  });

  it('detectLanguage returns null when detection throws', async () => {
    (globalThis as any).LanguageDetector = {
      create: jest.fn().mockRejectedValue(new Error('boom'))
    };
    expect(await service.detectLanguage('你好')).toBeNull();
  });
});

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
