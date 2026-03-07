import {
  getFeaturedPlaylistsHasMore,
  getFeaturedPlaylistsLoading,
  getFeaturedPlaylistsMessage,
  getFeaturedPlaylistsWithRouteUrl,
  loadMoreFeaturedPlaylists,
} from '@angular-spotify/web/home/data-access';
import { PlayerApiService } from '@angular-spotify/web/shared/data-access/spotify-api';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { select, Store } from '@ngrx/store';

@Component({
  selector: 'as-featured-playlists',
  templateUrl: './featured-playlists.component.html',
  styleUrls: ['./featured-playlists.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeaturedPlaylistsComponent {
  featuredPlaylists$ = this.store.pipe(select(getFeaturedPlaylistsWithRouteUrl));
  message$ = this.store.pipe(select(getFeaturedPlaylistsMessage));
  hasMore$ = this.store.pipe(select(getFeaturedPlaylistsHasMore));
  isLoading$ = this.store.pipe(select(getFeaturedPlaylistsLoading));

  constructor(private store: Store, private playerApi: PlayerApiService) {}

  togglePlay(isPlaying: boolean, playlistUri: string) {
    this.playerApi
      .togglePlay(isPlaying, {
        context_uri: playlistUri
      })
      .subscribe();
  }

  loadMore() {
    this.store.dispatch(loadMoreFeaturedPlaylists());
  }
}
