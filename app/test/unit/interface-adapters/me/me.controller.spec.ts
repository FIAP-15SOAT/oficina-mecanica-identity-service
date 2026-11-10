import { MeController } from '@interface-adapters/me/me.controller';
import { MePresenter } from '@interface-adapters/me/me.presenter';
import { IChangeOwnPasswordUseCase } from '@application/ports/input/me/change-own-password.use-case.interface';
import { IGetUserProfileUseCase } from '@application/ports/input/me/get-user-profile.use-case.interface';
import { AuthFlow } from '@domain/enums/auth-flow.enum';

import { createMockUser } from '../../../helpers/user-mock.factory';
import { readInternalUserCustomersFixture } from '../../../helpers/work-order-user-customers-gateway-mock.factory';

describe('MeController', () => {
  let controller: MeController;
  let changeOwnPasswordUseCase: jest.Mocked<IChangeOwnPasswordUseCase>;
  let getUserProfileUseCase: jest.Mocked<IGetUserProfileUseCase>;

  beforeEach(() => {
    changeOwnPasswordUseCase = { execute: jest.fn() };

    getUserProfileUseCase = { execute: jest.fn() };

    controller = new MeController(changeOwnPasswordUseCase, getUserProfileUseCase);
  });

  it('should present the profile of the principal subject', async () => {
    const profile = {
      ...createMockUser().toPublicView(),
      customers: readInternalUserCustomersFixture().data,
    };
    getUserProfileUseCase.execute.mockResolvedValue(profile);

    const response = await controller.getMe({ sub: profile.id, authFlow: AuthFlow.CUSTOMER });

    expect(response).toEqual(MePresenter.toMeDataResponse(profile));
    expect(getUserProfileUseCase.execute).toHaveBeenCalledWith(profile.id);
  });

  it('should change the password of the given user', async () => {
    const input = { currentPassword: 'Current@123', newPassword: 'NewPass@456' };

    await controller.changePassword('user-id', input);

    expect(changeOwnPasswordUseCase.execute).toHaveBeenCalledWith('user-id', input);
  });
});
