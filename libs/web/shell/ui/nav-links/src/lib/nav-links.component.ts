import { getPlaylistItems, getPlaylistsLoading, getPlaylistsHasMore, loadMorePlaylists } from '@angular-spotify/web/playlist/data-access';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { select, Store } from '@ngrx/store';
@Component({
  selector: 'as-nav-links',
  templateUrl: './nav-links.component.html',
  styleUrls: ['./nav-links.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavLinksComponent {
  playlists$ = this.store.pipe(select(getPlaylistItems));
  isPlaylistsLoading$ = this.store.pipe(select(getPlaylistsLoading));
  hasMore$ = this.store.pipe(select(getPlaylistsHasMore));

  constructor(private store: Store) {}

  loadMore() {
    this.store.dispatch(loadMorePlaylists());
  }
}
