import { GenericState } from './generic-state';

export interface PaginatedState<T> extends GenericState<T[]> {
  next: string | null;
  total: number;
  offset: number;
  limit: number;
}

export function createInitialPaginatedState<T>(limit: number): PaginatedState<T> {
  return {
    data: null,
    status: 'pending',
    error: null,
    next: null,
    total: 0,
    offset: 0,
    limit,
  };
}

export function onLoadPage<T>(state: PaginatedState<T>): PaginatedState<T> {
  return { ...state, status: 'loading' as const };
}

export function onLoadPageSuccess<T>(
  state: PaginatedState<T>,
  pagingObject: { items: T[]; next: string | null; total: number; offset: number; limit: number }
): PaginatedState<T> {
  const existing = state.data || [];
  const existingIds = new Set(existing.map((item: any) => item.id).filter(Boolean));
  const newItems = existingIds.size > 0
    ? pagingObject.items.filter((item: any) => !existingIds.has(item.id))
    : pagingObject.items;
  return {
    ...state,
    data: [...existing, ...newItems],
    next: pagingObject.next,
    total: pagingObject.total,
    offset: pagingObject.offset,
    limit: pagingObject.limit,
    status: 'success' as const,
    error: null,
  };
}

export function onLoadPageError<T>(state: PaginatedState<T>, error: string): PaginatedState<T> {
  return { ...state, status: 'error' as const, error };
}

export function selectHasMore<T>(state: PaginatedState<T>): boolean {
  return state.next !== null;
}
