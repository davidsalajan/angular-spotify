import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { SvgIconComponent } from '@ngneat/svg-icon';
import { LyricsToggleComponent } from './lyrics-toggle.component';

@NgModule({
  imports: [CommonModule, NzToolTipModule, SvgIconComponent],
  declarations: [LyricsToggleComponent],
  exports: [LyricsToggleComponent]
})
export class LyricsToggleModule {}
