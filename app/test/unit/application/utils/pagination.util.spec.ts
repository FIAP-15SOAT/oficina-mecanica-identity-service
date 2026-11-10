import { buildPaginatedResult, buildPaginationMeta } from '@application/utils/pagination.util';

describe('pagination.util', () => {
  describe('buildPaginationMeta', () => {
    it('should round the total pages up', () => {
      const meta = buildPaginationMeta(21, { page: 2, limit: 10 });

      expect(meta).toEqual({ totalRecords: 21, totalPages: 3, page: 2, limit: 10 });
    });

    it('should return zero pages when there are no records', () => {
      const meta = buildPaginationMeta(0, { page: 1, limit: 10 });

      expect(meta.totalPages).toBe(0);
    });
  });

  describe('buildPaginatedResult', () => {
    it('should combine the items with the pagination meta', () => {
      const result = buildPaginatedResult({ items: ['a', 'b'], total: 2 }, { page: 1, limit: 10 });

      expect(result).toEqual({
        items: ['a', 'b'],
        pagination: { totalRecords: 2, totalPages: 1, page: 1, limit: 10 },
      });
    });
  });
});
