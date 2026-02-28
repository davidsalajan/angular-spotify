import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LyricsComponent } from './lyrics.component';
import { LyricsViewModule } from '@angular-spotify/web/lyrics/ui/lyrics-view';
import { SpinnerModule } from '@angular-spotify/web/shared/ui/spinner';

@NgModule({
  imports: [
    CommonModule,
    LyricsViewModule,
    SpinnerModule,
    RouterModule.forChild([
      {
        path: '',
        component: LyricsComponent
      }
    ])
  ],
  declarations: [LyricsComponent],
  exports: [LyricsComponent]
})
export class LyricsModule {}
