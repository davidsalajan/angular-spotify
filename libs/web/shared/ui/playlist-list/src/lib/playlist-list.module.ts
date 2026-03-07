import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlaylistListComponent } from './playlist-list.component';
import { CardComponent } from '@angular-spotify/web/shared/ui/media';
import { SpinnerModule } from '@angular-spotify/web/shared/ui/spinner';
import { InfiniteScrollDirective } from '@angular-spotify/web/shared/ui/infinite-scroll';

@NgModule({
  imports: [CommonModule, CardComponent, SpinnerModule, InfiniteScrollDirective],
  declarations: [PlaylistListComponent],
  exports: [PlaylistListComponent]
})
export class PlaylistListModule {}
