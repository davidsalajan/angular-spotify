import { TranslatorAnnotatorConfig } from '../annotation.models';
import { containsLetters } from '../script-util';

export const VI_EN_ANNOTATOR: TranslatorAnnotatorConfig = {
  id: 'vi-en',
  kind: 'translator',
  matchesLanguage: (lang) => lang.startsWith('vi'),
  lineQualifies: containsLetters,
  sourceLanguage: 'vi',
  targetLanguage: 'en',
  toggle: {
    icon: 'EN',
    tooltipShow: 'Show English translation',
    tooltipHide: 'Hide English translation',
    preparingLabel: 'Preparing translation…'
  }
};
