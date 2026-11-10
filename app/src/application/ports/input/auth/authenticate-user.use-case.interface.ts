import {
  AuthenticateUserInputDto,
  AuthenticateUserOutputDto,
} from '@application/ports/input/auth/dto/authenticate-user.dto';

export interface IAuthenticateUserUseCase {
  execute(input: AuthenticateUserInputDto): Promise<AuthenticateUserOutputDto>;
}
