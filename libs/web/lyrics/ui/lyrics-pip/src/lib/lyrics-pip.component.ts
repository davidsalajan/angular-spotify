import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  QueryList,
  ViewChildren
} from '@angular/core';
import { LyricLine } from '@angular-spotify/web/lyrics/data-access';

@Component({
  selector: 'as-lyrics-pip',
  templateUrl: './lyrics-pip.component.html',
  styleUrls: ['./lyrics-pip.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LyricsPipComponent implements AfterViewChecked {
  @Input() lyrics: LyricLine[] | null = null;
  @Input() activeLine = -1;
  @Input() isSynced = false;
  @Output() expand = new EventEmitter<void>();
  @Output() closePip = new EventEmitter<void>();
  @Output() seekTo = new EventEmitter<number>();

  @ViewChildren('lyricLine') lyricLineElements!: QueryList<ElementRef>;

  private lastScrolledLine = -1;

  ngAfterViewChecked(): void {
    if (this.activeLine >= 0 && this.activeLine !== this.lastScrolledLine) {
      this.scrollToActiveLine();
      this.lastScrolledLine = this.activeLine;
    }
  }

  onLineClick(line: LyricLine): void {
    if (this.isSynced && line.time !== null) {
      this.seekTo.emit(line.time);
    }
  }

  private scrollToActiveLine(): void {
    const elements = this.lyricLineElements?.toArray();
    const activeEl = elements?.[this.activeLine]?.nativeElement as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}
