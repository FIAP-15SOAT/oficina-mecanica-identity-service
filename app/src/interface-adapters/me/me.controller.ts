import { AuthenticatedPrincipal } from '@application/auth/authenticated-principal';
import { IChangeOwnPasswordUseCase } from '@application/ports/input/me/change-own-password.use-case.interface';
import { ChangeOwnPasswordDto } from '@application/ports/input/me/dto/change-own-password.dto';
import { IGetUserProfileUseCase } from '@application/ports/input/me/get-user-profile.use-case.interface';

import { MePresenter } from './me.presenter';
import { MeDataResponse } from './responses/me.response';

export class MeController {
  constructor(
    private readonly changeOwnPasswordUseCase: IChangeOwnPasswordUseCase,
    private readonly getUserProfileUseCase: IGetUserProfileUseCase,
  ) {}

  async changePassword(userId: string, input: ChangeOwnPasswordDto): Promise<void> {
    await this.changeOwnPasswordUseCase.execute(userId, input);
  }

  async getMe(principal: AuthenticatedPrincipal): Promise<MeDataResponse> {
    const profile = await this.getUserProfileUseCase.execute(principal.sub);
    return MePresenter.toMeDataResponse(profile);
  }
}
