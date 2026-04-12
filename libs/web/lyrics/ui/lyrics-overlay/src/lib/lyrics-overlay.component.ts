import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { LyricsStore } from '@angular-spotify/web/lyrics/data-access';
import { PlaybackStore } from '@angular-spotify/web/shared/data-access/store';
import { combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

interface CurveOrigin {
  startX: string;
  startY: string;
  controlX1: string;
  controlY1: string;
}

interface DriftPattern {
  x1: string;
  y1: string;
  x2: string;
  y2: string;
}

interface OverlayLines {
  previousText: string;
  currentText: string;
  nextText: string;
  entryOrigin: CurveOrigin;
  drift: DriftPattern;
  floatDuration: string;
}

const CALM_ORIGINS: CurveOrigin[] = [
  { startX: '-120px', startY: '40%', controlX1: '10%', controlY1: '35%' },
  { startX: 'calc(100% + 120px)', startY: '60%', controlX1: '90%', controlY1: '55%' },
  { startX: '-100px', startY: '55%', controlX1: '15%', controlY1: '50%' },
  { startX: 'calc(100% + 100px)', startY: '45%', controlX1: '85%', controlY1: '48%' }
];

const DRIFT_PATTERNS: DriftPattern[] = [
  { x1: '-10px', y1: '-8px', x2: '10px', y2: '8px' },   // top-left → bottom-right
  { x1: '-10px', y1: '8px', x2: '10px', y2: '-8px' },    // bottom-left → top-right
  { x1: '10px', y1: '-8px', x2: '-10px', y2: '8px' },    // top-right → bottom-left
  { x1: '10px', y1: '8px', x2: '-10px', y2: '-8px' },    // bottom-right → top-left
  { x1: '-12px', y1: '0', x2: '8px', y2: '6px' },        // left → bottom-right
  { x1: '0', y1: '-10px', x2: '-8px', y2: '6px' },       // top → bottom-left
];

const INTENSE_ORIGINS: CurveOrigin[] = [
  { startX: '-150px', startY: '10%', controlX1: '5%', controlY1: '5%' },
  { startX: 'calc(100% + 150px)', startY: '90%', controlX1: '95%', controlY1: '95%' },
  { startX: 'calc(100% + 130px)', startY: '5%', controlX1: '90%', controlY1: '10%' },
  { startX: '-130px', startY: '85%', controlX1: '10%', controlY1: '90%' },
  { startX: '50%', startY: '-80px', controlX1: '45%', controlY1: '5%' },
  { startX: '50%', startY: 'calc(100% + 80px)', controlX1: '55%', controlY1: '95%' }
];

@Component({
  selector: 'as-lyrics-overlay',
  templateUrl: './lyrics-overlay.component.html',
  styleUrls: ['./lyrics-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LyricsOverlayComponent implements OnInit {
  lines$!: Observable<OverlayLines | null>;

  private lineCounter = 0;

  constructor(
    private lyricsStore: LyricsStore,
    private playbackStore: PlaybackStore
  ) {}

  ngOnInit(): void {
    this.lines$ = combineLatest([
      this.lyricsStore.lyrics$,
      this.lyricsStore.activeLine$,
      this.playbackStore.segments$.pipe(map((s) => s.segments))
    ]).pipe(
      map(([lyrics, activeIdx, segments]) => {
        if (!lyrics || activeIdx < 0) return null;
        const line = lyrics[activeIdx];
        if (!line || line.time === null) return null;

        const energy = this.estimateEnergy(line.time, segments);
        const origin = this.pickOrigin(energy);
        const drift = DRIFT_PATTERNS[Math.floor(Math.random() * DRIFT_PATTERNS.length)];
        const nextTime = lyrics[activeIdx + 1]?.time;
        const durationSec = nextTime != null ? Math.max((nextTime - line.time) / 1000, 1) : 5;

        return {
          previousText: activeIdx > 0 ? (lyrics[activeIdx - 1]?.text || '') : '',
          currentText: line.text,
          nextText: lyrics[activeIdx + 1]?.text || '',
          entryOrigin: origin,
          drift,
          floatDuration: `${durationSec}s`
        };
      }),
      distinctUntilChanged((a, b) => {
        if (a === null && b === null) return true;
        if (a === null || b === null) return false;
        return a.currentText === b.currentText;
      })
    );
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
}
