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
