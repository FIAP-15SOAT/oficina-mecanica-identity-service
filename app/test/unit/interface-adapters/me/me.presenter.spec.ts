import { MePresenter } from '@interface-adapters/me/me.presenter';
import { UserRole } from '@domain/enums/user-role.enum';

import { createMockUser } from '../../../helpers/user-mock.factory';
import { readInternalUserCustomersFixture } from '../../../helpers/work-order-user-customers-gateway-mock.factory';

describe('MePresenter', () => {
  describe('toMeDataResponse', () => {
    it('should keep only COMPANY customers', () => {
      const user = createMockUser({ role: UserRole.ATTENDANT }).toPublicView();
      const [individual, company] = readInternalUserCustomersFixture().data;

      const response = MePresenter.toMeDataResponse({ ...user, customers: [individual, company] });

      expect(response).toEqual({
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: UserRole.ATTENDANT,
          customers: [{ id: company.id, name: company.name, type: 'COMPANY' }],
        },
      });
    });

    it('should answer an empty list when the user represents no company', () => {
      const user = createMockUser({ role: null }).toPublicView();
      const [individual] = readInternalUserCustomersFixture().data;

      const response = MePresenter.toMeDataResponse({ ...user, customers: [individual] });

      expect(response.data.customers).toEqual([]);
      expect(response.data.role).toBeNull();
    });
  });
});
