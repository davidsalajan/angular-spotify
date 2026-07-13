const HAN_REGEX = /[㐀-䶿一-鿿豈-﫿]/;
// Hiragana (U+3040–U+309F) + Katakana (U+30A0–U+30FF).
const KANA_REGEX = /[぀-ヿ]/;

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
