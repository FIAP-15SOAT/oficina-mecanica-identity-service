import { IAuthenticateCustomerCredentialUseCase } from '@application/ports/input/auth/authenticate-customer-credential.use-case.interface';
import { AuthenticateCustomerCredentialDto } from '@application/ports/input/auth/dto/authenticate-customer-credential.dto';
import { EnsureCustomerUserDto } from '@application/ports/input/user/dto/ensure-customer-user.dto';
import { IEnsureCustomerUserUseCase } from '@application/ports/input/user/ensure-customer-user.use-case.interface';
import { IFindUserByIdUseCase } from '@application/ports/input/user/find-user-by-id.use-case.interface';

import { UserPresenter } from './user.presenter';
import {
  InternalCustomerAuthenticationDataResponse,
  InternalCustomerUserDataResponse,
  InternalUserDataResponse,
} from './responses/internal-user.response';

// Internal routes answer only what the calling services need, with no timestamps.
export class InternalUserController {
  constructor(
    private readonly findUserByIdUseCase: IFindUserByIdUseCase,
    private readonly ensureCustomerUserUseCase: IEnsureCustomerUserUseCase,
    private readonly authenticateCustomerCredentialUseCase: IAuthenticateCustomerCredentialUseCase,
  ) {}

  async findOne(id: string): Promise<InternalUserDataResponse> {
    return UserPresenter.toInternalDataResponse(await this.findUserByIdUseCase.execute(id));
  }

  async ensureCustomerUser(
    input: EnsureCustomerUserDto,
  ): Promise<InternalCustomerUserDataResponse> {
    return UserPresenter.toCustomerUserDataResponse(
      await this.ensureCustomerUserUseCase.execute(input),
    );
  }

  async authenticateCustomerCredential(
    input: AuthenticateCustomerCredentialDto,
  ): Promise<InternalCustomerAuthenticationDataResponse> {
    return UserPresenter.toCustomerAuthenticationDataResponse(
      await this.authenticateCustomerCredentialUseCase.execute(input),
    );
  }
}
