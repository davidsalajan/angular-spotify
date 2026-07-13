import { containsHan, containsJapanese } from './script-util';

describe('containsHan', () => {
  it('returns true for simplified and traditional Han characters', () => {
    expect(containsHan('月亮代表我的心')).toBe(true);
    expect(containsHan('愛')).toBe(true);
  });

  it('returns false for non-Han text', () => {
    expect(containsHan('hello world')).toBe(false);
    expect(containsHan('')).toBe(false);
    expect(containsHan('123 !@#')).toBe(false);
  });

  it('returns true for mixed lines containing any Han', () => {
    expect(containsHan('La la 月亮')).toBe(true);
  });

  it('returns false for Hangul (Korean) characters', () => {
    expect(containsHan('한국어')).toBe(false);
  });
});

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
