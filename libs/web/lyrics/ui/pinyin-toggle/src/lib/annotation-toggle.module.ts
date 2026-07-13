import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { AnnotationToggleComponent } from './annotation-toggle.component';

@NgModule({
  imports: [CommonModule, NzToolTipModule],
  declarations: [AnnotationToggleComponent],
  exports: [AnnotationToggleComponent]
})
export class AnnotationToggleModule {}
