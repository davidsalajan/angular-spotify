import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VisualizerStore } from '@angular-spotify/web/visualizer/data-access';

@Component({
  selector: 'as-visualizer',
  templateUrl: './visualizer.component.html',
  styleUrls: ['./visualizer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisualizerComponent {
  showLyricsOverlay$ = this.visualizerStore.showLyricsOverlay$;

  constructor(private visualizerStore: VisualizerStore) {}
}
