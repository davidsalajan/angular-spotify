import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LetDirective } from '@ngrx/component';
import { LyricsOverlayComponent } from './lyrics-overlay.component';

@NgModule({
  imports: [CommonModule, LetDirective],
  declarations: [LyricsOverlayComponent],
  exports: [LyricsOverlayComponent]
})
export class LyricsOverlayModule {}
