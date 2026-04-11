import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LyricsStore } from '@angular-spotify/web/lyrics/data-access';
import { map } from 'rxjs/operators';

@Component({
  selector: 'as-lyrics-toggle',
  templateUrl: './lyrics-toggle.component.html',
  styleUrls: ['./lyrics-toggle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LyricsToggleComponent {
  isLyricsOn$ = this.lyricsStore.isVisible$;
  hasLyrics$ = this.lyricsStore.lyrics$.pipe(
    map((lyrics) => lyrics !== null && lyrics.length > 0)
  );
  private isVisible = false;

  constructor(private lyricsStore: LyricsStore) {
    this.isLyricsOn$.subscribe((v) => (this.isVisible = v));
  }

  toggle(): void {
    this.lyricsStore.setVisibility({ isVisible: !this.isVisible });
  }
}
