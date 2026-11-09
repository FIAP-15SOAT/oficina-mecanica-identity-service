import {
  PaginatedRepositoryResult,
  PaginatedResult,
  PaginationInput,
  PaginationMeta,
} from '@domain/interfaces/common/pagination.interface';

export function calculateTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}

export function buildPaginationMeta(total: number, input: PaginationInput): PaginationMeta {
  return {
    totalRecords: total,
    totalPages: calculateTotalPages(total, input.limit),
    page: input.page,
    limit: input.limit,
  };
}

export function buildPaginatedResult<T>(
  data: PaginatedRepositoryResult<T>,
  input: PaginationInput,
): PaginatedResult<T> {
  return {
    items: data.items,
    pagination: buildPaginationMeta(data.total, input),
  };
}
