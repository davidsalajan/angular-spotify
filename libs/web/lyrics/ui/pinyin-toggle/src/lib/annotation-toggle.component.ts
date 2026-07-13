import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LyricsAnnotationStore } from '@angular-spotify/web/lyrics/data-access';

@Component({
  selector: 'as-annotation-toggle',
  templateUrl: './annotation-toggle.component.html',
  styleUrls: ['./annotation-toggle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnotationToggleComponent {
  showToggle$ = this.annotationStore.showToggle$;
  isEnabled$ = this.annotationStore.enabled$;
  annotator$ = this.annotationStore.activeAnnotator$;
  private isEnabled = true;

  constructor(private annotationStore: LyricsAnnotationStore) {
    this.isEnabled$.subscribe((v) => (this.isEnabled = v));
  }

  toggle(): void {
    this.annotationStore.setEnabled(!this.isEnabled);
  }
}
