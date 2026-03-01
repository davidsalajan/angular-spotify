import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LyricsViewComponent } from './lyrics-view.component';

@NgModule({
  imports: [CommonModule],
  declarations: [LyricsViewComponent],
  exports: [LyricsViewComponent]
})
export class LyricsViewModule {}
