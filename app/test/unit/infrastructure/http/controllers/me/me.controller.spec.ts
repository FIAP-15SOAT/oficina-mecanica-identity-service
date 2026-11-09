import { MeController } from '@infrastructure/http/controllers/me/me.controller';
import { MeController as MeCleanController } from '@interface-adapters/me/me.controller';
import { MePresenter } from '@interface-adapters/me/me.presenter';
import { AuthenticatedPrincipal } from '@application/auth/authenticated-principal';
import { AuthFlow } from '@domain/enums/auth-flow.enum';
import { UserRole } from '@domain/enums/user-role.enum';

import { createMockUser } from '../../../../../helpers/user-mock.factory';

describe('MeController', () => {
  let httpController: MeController;
  let cleanController: MeCleanController;

  const principal: AuthenticatedPrincipal = {
    sub: 'user-id',
    authFlow: AuthFlow.INTERNAL,
    email: 'ana@example.com',
    role: UserRole.ADMIN,
  };

  beforeEach(() => {
    cleanController = new MeCleanController({ execute: jest.fn() }, { execute: jest.fn() });

    httpController = new MeController(cleanController);
  });

  it('should delegate GET /me to the clean controller with the principal', async () => {
    const response = MePresenter.toMeDataResponse({
      ...createMockUser().toPublicView(),
      customers: [],
    });

    jest.spyOn(cleanController, 'getMe').mockResolvedValue(response);

    const result = await httpController.getMe(principal);

    expect(result).toBe(response);
    expect(cleanController.getMe).toHaveBeenCalledWith(principal);
  });

  it('should delegate PATCH /me/password with the principal subject', async () => {
    const request = { currentPassword: 'Current@123', newPassword: 'NewPass@456' };

    jest.spyOn(cleanController, 'changePassword').mockResolvedValue(undefined);

    await httpController.changePassword(request, principal);

    expect(cleanController.changePassword).toHaveBeenCalledWith('user-id', request);
  });
});
