export interface PaginationMeta {
  total: number
  page: number
  limit: number
  hasNextPage: boolean
  nextCursor?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export interface CursorPaginationMeta {
  hasMore: boolean
  nextCursor?: string
  oldest?: string
}

export interface CursorPaginatedResponse<T> {
  data: T[]
  meta: CursorPaginationMeta
}
