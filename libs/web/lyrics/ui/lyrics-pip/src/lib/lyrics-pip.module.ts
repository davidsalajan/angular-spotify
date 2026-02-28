import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LyricsPipComponent } from './lyrics-pip.component';

@NgModule({
  imports: [CommonModule],
  declarations: [LyricsPipComponent],
  exports: [LyricsPipComponent]
})
export class LyricsPipModule {}
