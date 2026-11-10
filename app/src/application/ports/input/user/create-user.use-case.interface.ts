import {
  CreateUserDto,
  CreateUserOutputDto,
} from '@application/ports/input/user/dto/create-user.dto';

export interface ICreateUserUseCase {
  execute(createUserDto: CreateUserDto): Promise<CreateUserOutputDto>;
}
