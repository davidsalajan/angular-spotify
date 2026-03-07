import {
  getPlaylistItems,
  getPlaylistsLoading,
  getPlaylistsHasMore,
  loadMorePlaylists,
} from '@angular-spotify/web/playlist/data-access';
import { SelectorUtil } from '@angular-spotify/web/shared/utils';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { select, Store } from '@ngrx/store';
import { map } from 'rxjs/operators';

@Component({
  selector: 'as-playlists',
  templateUrl: './playlists.component.html',
  styleUrls: ['./playlists.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaylistsComponent {
  playlists$ = this.store.pipe(
    select(getPlaylistItems),
    map((items) => SelectorUtil.getPlaylistsWithRoute(items))
  );
  isPlaylistsLoading$ = this.store.pipe(select(getPlaylistsLoading));
  hasMore$ = this.store.pipe(select(getPlaylistsHasMore));

  constructor(private store: Store) {}

  loadMore() {
    this.store.dispatch(loadMorePlaylists());
  }
}
