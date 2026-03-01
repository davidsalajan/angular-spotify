import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SvgIconComponent } from '@ngneat/svg-icon';
import { LyricsPipComponent } from './lyrics-pip.component';

@NgModule({
  imports: [CommonModule, SvgIconComponent],
  declarations: [LyricsPipComponent],
  exports: [LyricsPipComponent]
})
export class LyricsPipModule {}
