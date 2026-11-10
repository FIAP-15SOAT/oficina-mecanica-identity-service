import {
  PaginationInput,
  PaginatedRepositoryResult,
} from '@domain/interfaces/common/pagination.interface';

type PrismaModelDelegate<TResult> = {
  findMany(args?: Record<string, unknown>): Promise<TResult[]>;
  count(args?: Record<string, unknown>): Promise<number>;
};

export async function paginate<TResult, TArgs extends { where?: unknown } = { where?: unknown }>(
  delegate: PrismaModelDelegate<TResult>,
  args: TArgs,
  input: PaginationInput,
): Promise<PaginatedRepositoryResult<TResult>> {
  const skip = (input.page - 1) * input.limit;

  const [items, total] = await Promise.all([
    delegate.findMany({ ...(args as Record<string, unknown>), skip, take: input.limit }),
    delegate.count({ where: args.where }),
  ]);

  return { items, total };
}
