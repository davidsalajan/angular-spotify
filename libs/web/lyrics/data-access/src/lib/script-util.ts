// Escaped ranges on purpose: the CJK compatibility block start U+F900 (豈) is
// NFC-normalized to U+8C48 by many tools, silently widening the range over
// Hangul. Escapes are ASCII and survive any normalization.
// CJK ext-A (U+3400–U+4DBF) + unified (U+4E00–U+9FFF) + compat (U+F900–U+FAFF).
const HAN_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
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
