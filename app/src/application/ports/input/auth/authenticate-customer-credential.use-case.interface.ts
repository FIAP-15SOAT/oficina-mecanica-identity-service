import {
  AuthenticateCustomerCredentialDto,
  AuthenticateCustomerCredentialOutputDto,
} from './dto/authenticate-customer-credential.dto';

export interface IAuthenticateCustomerCredentialUseCase {
  execute(
    input: AuthenticateCustomerCredentialDto,
  ): Promise<AuthenticateCustomerCredentialOutputDto>;
}
