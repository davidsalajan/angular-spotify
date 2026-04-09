import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VisualizerComponent } from './visualizer.component';
import { RouterModule } from '@angular/router';
import { WebVisualizerUiModule } from '@angular-spotify/web/visualizer/ui';
import { LyricsOverlayModule } from '@angular-spotify/web/lyrics/ui/lyrics-overlay';

@NgModule({
  imports: [
    CommonModule,
    WebVisualizerUiModule,
    LyricsOverlayModule,
    RouterModule.forChild([
      {
        path: '',
        component: VisualizerComponent
      }
    ])
  ],
  declarations: [VisualizerComponent],
  exports: [VisualizerComponent]
})
export class VisualizerModule {}
