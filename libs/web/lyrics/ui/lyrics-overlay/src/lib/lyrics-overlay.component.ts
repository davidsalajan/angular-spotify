import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { LyricsStore } from '@angular-spotify/web/lyrics/data-access';
import { PlaybackStore } from '@angular-spotify/web/shared/data-access/store';
import { UntilDestroy } from '@ngneat/until-destroy';
import { combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

interface WordTiming {
  text: string;
  startProgress: number;
  endProgress: number;
}

interface AnimatedLine {
  words: WordTiming[];
  entryOrigin: CurveOrigin;
  progress: number;
}

interface CurveOrigin {
  startX: string;
  startY: string;
  controlX1: string;
  controlY1: string;
}

const CALM_ORIGINS: CurveOrigin[] = [
  { startX: '-120px', startY: '40%', controlX1: '10%', controlY1: '35%' },
  { startX: 'calc(100% + 120px)', startY: '60%', controlX1: '90%', controlY1: '55%' },
  { startX: '-100px', startY: '55%', controlX1: '15%', controlY1: '50%' },
  { startX: 'calc(100% + 100px)', startY: '45%', controlX1: '85%', controlY1: '48%' }
];

const INTENSE_ORIGINS: CurveOrigin[] = [
  { startX: '-150px', startY: '10%', controlX1: '5%', controlY1: '5%' },
  { startX: 'calc(100% + 150px)', startY: '90%', controlX1: '95%', controlY1: '95%' },
  { startX: 'calc(100% + 130px)', startY: '5%', controlX1: '90%', controlY1: '10%' },
  { startX: '-130px', startY: '85%', controlX1: '10%', controlY1: '90%' },
  { startX: '50%', startY: '-80px', controlX1: '45%', controlY1: '5%' },
  { startX: '50%', startY: 'calc(100% + 80px)', controlX1: '55%', controlY1: '95%' }
];

@UntilDestroy()
@Component({
  selector: 'as-lyrics-overlay',
  templateUrl: './lyrics-overlay.component.html',
  styleUrls: ['./lyrics-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LyricsOverlayComponent implements OnInit {
  currentLine$!: Observable<AnimatedLine | null>;
  nextLineText$!: Observable<string>;
  wordProgress$!: Observable<number>;

  private lineCounter = 0;

  constructor(
    private lyricsStore: LyricsStore,
    private playbackStore: PlaybackStore
  ) {}

  ngOnInit(): void {
    this.currentLine$ = combineLatest([
      this.lyricsStore.lyrics$,
      this.lyricsStore.activeLine$,
      this.playbackStore.segments$.pipe(map((s) => s.segments))
    ]).pipe(
      map(([lyrics, activeIdx, segments]) => {
        if (!lyrics || activeIdx < 0) return null;
        const line = lyrics[activeIdx];
        if (!line || line.time === null) return null;

        const nextLine = lyrics[activeIdx + 1];
        const lineDuration =
          nextLine?.time !== null && nextLine?.time !== undefined
            ? nextLine.time - line.time
            : 4000;

        const words = this.buildWordTimings(line.text, lineDuration);
        const energy = this.estimateEnergy(line.time, segments);
        const origin = this.pickOrigin(energy);

        return { words, entryOrigin: origin, progress: 0 };
      }),
      distinctUntilChanged((a, b) => {
        if (a === null && b === null) return true;
        if (a === null || b === null) return false;
        return a.words.map((w) => w.text).join(' ') === b.words.map((w) => w.text).join(' ');
      })
    );

    this.nextLineText$ = combineLatest([
      this.lyricsStore.lyrics$,
      this.lyricsStore.activeLine$
    ]).pipe(
      map(([lyrics, activeIdx]) => {
        if (!lyrics || activeIdx < 0) return '';
        return lyrics[activeIdx + 1]?.text || '';
      }),
      distinctUntilChanged()
    );

    this.wordProgress$ = combineLatest([
      this.lyricsStore.lyrics$,
      this.lyricsStore.activeLine$,
      this.lyricsStore.interpolatedPosition$
    ]).pipe(
      map(([lyrics, activeIdx, position]) => {
        if (!lyrics || activeIdx < 0) return 0;
        const line = lyrics[activeIdx];
        if (!line || line.time === null) return 0;

        const nextLine = lyrics[activeIdx + 1];
        const lineDuration =
          nextLine?.time !== null && nextLine?.time !== undefined
            ? nextLine.time - line.time
            : 4000;

        const elapsed = position - line.time;
        return Math.min(1, Math.max(0, elapsed / lineDuration));
      }),
      distinctUntilChanged()
    );
  }

  private buildWordTimings(text: string, lineDuration: number): WordTiming[] {
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) return [];

    const sliceSize = 1 / words.length;
    return words.map((word, i) => ({
      text: word,
      startProgress: i * sliceSize,
      endProgress: (i + 1) * sliceSize
    }));
  }

  private estimateEnergy(
    timeMs: number,
    segments: Array<{ start: number; pitches: number[] }> | undefined
  ): number {
    if (!segments || segments.length === 0) return 0.5;
    const seg = segments.find((s) => s.start >= timeMs);
    if (!seg) return 0.5;
    const avg = seg.pitches.reduce((a, b) => a + b, 0) / seg.pitches.length;
    return avg / 2;
  }

  private pickOrigin(energy: number): CurveOrigin {
    this.lineCounter++;
    const origins = energy > 0.4 ? INTENSE_ORIGINS : CALM_ORIGINS;
    return origins[this.lineCounter % origins.length];
  }

  getWordClass(word: WordTiming, progress: number): string {
    if (progress >= word.endProgress) return 'word-past';
    if (progress >= word.startProgress) return 'word-active';
    return 'word-upcoming';
  }
}
