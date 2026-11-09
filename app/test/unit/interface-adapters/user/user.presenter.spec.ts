import { UserPresenter } from '@interface-adapters/user/user.presenter';
import { createMockUser } from '../../../helpers/user-mock.factory';

describe('UserPresenter', () => {
  describe('toResponse', () => {
    it('should map all user fields correctly', () => {
      const user = createMockUser({ name: 'Carlos Mecânico', isActive: false });
      const publicView = user.toPublicView();

      const response = UserPresenter.toResponse(publicView);

      expect(response.id).toBe(publicView.id);
      expect(response.name).toBe('Carlos Mecânico');
      expect(response.email).toBe(publicView.email);
      expect(response.role).toBe(publicView.role);
      expect(response.isActive).toBe(false);
      expect(response.createdAt).toBe(publicView.createdAt);
      expect(response.updatedAt).toBe(publicView.updatedAt);
    });
  });

  describe('toDataResponse', () => {
    it('should wrap the user response in a data property', () => {
      const publicView = createMockUser().toPublicView();

      const result = UserPresenter.toDataResponse(publicView);

      expect(result.data).toBeDefined();
      expect(result.data.id).toBe(publicView.id);
    });
  });

  describe('toPaginatedResponse', () => {
    it('should map items and preserve pagination metadata', () => {
      const users = [createMockUser().toPublicView(), createMockUser().toPublicView()];
      const pagination = { totalRecords: 2, totalPages: 1, page: 1, limit: 10 };

      const result = UserPresenter.toPaginatedResponse({ items: users, pagination });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe(users[0].id);
      expect(result.data[1].id).toBe(users[1].id);
      expect(result.pagination).toEqual(pagination);
    });

    it('should return empty data array when items is empty', () => {
      const result = UserPresenter.toPaginatedResponse({
        items: [],
        pagination: { totalRecords: 0, totalPages: 0, page: 1, limit: 10 },
      });

      expect(result.data).toHaveLength(0);
    });
  });
});
