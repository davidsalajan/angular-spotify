import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LyricsStore } from '@angular-spotify/web/lyrics/data-access';

@Component({
  selector: 'as-lyrics-toggle',
  templateUrl: './lyrics-toggle.component.html',
  styleUrls: ['./lyrics-toggle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LyricsToggleComponent {
  isLyricsOn$ = this.lyricsStore.isVisible$;

  constructor(private lyricsStore: LyricsStore) {}

  toggle(): void {
    const isVisible = this.lyricsStore.get().isVisible;
    this.lyricsStore.setVisibility({ isVisible: !isVisible });
  }
}
