import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { LyricLine } from '@angular-spotify/web/lyrics/data-access';

@Component({
  selector: 'as-lyrics-pip',
  templateUrl: './lyrics-pip.component.html',
  styleUrls: ['./lyrics-pip.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LyricsPipComponent {
  @Input() lyrics: LyricLine[] | null = null;
  @Input() activeLine = -1;
  @Output() expand = new EventEmitter<void>();

  get currentLine(): string {
    if (!this.lyrics || this.activeLine < 0) {
      return '';
    }
    return this.lyrics[this.activeLine]?.text || '';
  }

  get nextLine(): string {
    if (!this.lyrics || this.activeLine < 0) {
      return '';
    }
    return this.lyrics[this.activeLine + 1]?.text || '';
  }
}
