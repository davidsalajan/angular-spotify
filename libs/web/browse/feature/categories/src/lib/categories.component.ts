import { ChangeDetectionStrategy, Component } from '@angular/core';
import { select, Store } from '@ngrx/store';
import { getCategories, getCategoriesHasMore, getCategoriesLoading, loadCategories, loadMoreCategories } from '@angular-spotify/web/browse/data-access';

@Component({
  selector: 'as-categories',
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoriesComponent {
  isLoading$ = this.store.pipe(select(getCategoriesLoading));
  categories$ = this.store.pipe(select(getCategories));
  hasMore$ = this.store.pipe(select(getCategoriesHasMore));

  constructor(private store: Store) {
    this.store.dispatch(loadCategories());
  }

  loadMore() {
    this.store.dispatch(loadMoreCategories());
  }
}
