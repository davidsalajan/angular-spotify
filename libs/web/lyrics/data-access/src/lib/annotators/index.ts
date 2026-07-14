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
