import { PlaybackStore } from '@angular-spotify/web/shared/data-access/store';
import {
  initVisualizer,
  VisualizerInstance,
  VisualizerStore,
  VisualizerType,
  VISUALIZER_TYPE_LABELS
} from '@angular-spotify/web/visualizer/data-access';
import { DOCUMENT } from '@angular/common';
import { mean } from 'lodash-es';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { SpotifyApiAudioAnalysisBeat } from '@angular-spotify/web/shared/data-access/models';
import { timer } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { AudioData } from '@angular-spotify/web/visualizer/data-access';

const INTERVAL = 100;

@UntilDestroy()
@Component({
  selector: 'as-web-visualizer-ui',
  templateUrl: './web-visualizer-ui.component.html',
  styleUrls: ['./web-visualizer-ui.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WebVisualizerUiComponent implements OnInit, OnDestroy {
  isFullscreen = false;
  visualizerInstance!: VisualizerInstance;
  isVisualizerShownAsPiP$ = this.visualizerStore.isShownAsPiP$;
  visualizerType$ = this.visualizerStore.visualizerType$;

  visualizerTypes = Object.values(VisualizerType);
  visualizerTypeLabels = VISUALIZER_TYPE_LABELS;

  @ViewChild('visualizer', { static: true }) visualizer!: ElementRef;

  constructor(
    private playbackStore: PlaybackStore,
    @Inject(DOCUMENT) private readonly document: Document,
    private visualizerStore: VisualizerStore
  ) {}

  ngOnInit(): void {
    this.visualizerInstance = initVisualizer(this.visualizer.nativeElement);
    this.init();
    this.listenToTypeChanges();
  }

  init() {
    this.playbackStore.segments$
      .pipe(
        switchMap((data) =>
          timer(0, INTERVAL).pipe(
            map((num) => ({
              num,
              data
            }))
          )
        ),
        tap(({ num, data }) => {
          const { position, isPlaying, segments, beats, tempo } = data;
          if (!isPlaying) {
            return;
          }
          const currentPos = (position || 0) + num * INTERVAL;
          const segment = segments.find((seg) => seg.start >= currentPos);
          if (segment) {
            const avgPitch = mean(segment.pitches) / 2;
            const audioData: AudioData = {
              energy: avgPitch,
              pitches: segment.pitches || [],
              timbre: segment.timbre || [],
              tempo: tempo || 120,
              beatPhase: this.computeBeatPhase(currentPos, beats)
            };
            this.visualizerInstance.updateAudio(audioData);
          }
        }),
        untilDestroyed(this)
      )
      .subscribe();
  }

  private listenToTypeChanges() {
    this.visualizerType$
      .pipe(
        tap((type) => {
          this.visualizerInstance.setRenderer(type);
        }),
        untilDestroyed(this)
      )
      .subscribe();
  }

  /**
   * Compute beat phase (0-1) from current position and beats array.
   */
  private computeBeatPhase(currentPos: number, beats?: SpotifyApiAudioAnalysisBeat[]): number {
    if (!beats || beats.length === 0) {
      return 0;
    }
    let currentBeat: SpotifyApiAudioAnalysisBeat | undefined;
    for (let i = beats.length - 1; i >= 0; i--) {
      if (beats[i].start <= currentPos) {
        currentBeat = beats[i];
        break;
      }
    }
    if (!currentBeat || currentBeat.duration <= 0) {
      return 0;
    }
    const elapsed = currentPos - currentBeat.start;
    return Math.min(1, elapsed / currentBeat.duration);
  }

  onVisualizerTypeChange(type: VisualizerType) {
    this.visualizerStore.setVisualizerType(type);
  }

  toggleFullscreen() {
    if (this.isFullscreen) {
      this.document.exitFullscreen();
    } else {
      (this.visualizer.nativeElement as HTMLElement).requestFullscreen();
    }
    this.isFullscreen = !this.isFullscreen;
  }

  togglePiP() {
    this.visualizerStore.togglePiP();
  }

  close() {
    this.visualizerStore.setVisibility({ isVisible: false });
  }

  ngOnDestroy() {
    this.visualizerInstance.sketch.destroy();
  }
}
