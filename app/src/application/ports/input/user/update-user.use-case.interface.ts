import {
  UpdateUserDto,
  UpdateUserOutputDto,
} from '@application/ports/input/user/dto/update-user.dto';

export interface IUpdateUserUseCase {
  execute(id: string, updateUserDto: UpdateUserDto): Promise<UpdateUserOutputDto>;
}
