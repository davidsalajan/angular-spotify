import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeaturedPlaylistsComponent } from './featured-playlists.component';
import { CardComponent } from '@angular-spotify/web/shared/ui/media';
import { InfiniteScrollDirective } from '@angular-spotify/web/shared/ui/infinite-scroll';
import { SpinnerModule } from '@angular-spotify/web/shared/ui/spinner';

@NgModule({
  imports: [CommonModule, CardComponent, InfiniteScrollDirective, SpinnerModule],
  declarations: [FeaturedPlaylistsComponent],
  exports: [FeaturedPlaylistsComponent]
})
export class FeaturedPlaylistsModule {}
