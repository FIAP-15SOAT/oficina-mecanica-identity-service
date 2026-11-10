import { ChangeOwnPasswordDto } from './dto/change-own-password.dto';

export interface IChangeOwnPasswordUseCase {
  execute(userId: string, input: ChangeOwnPasswordDto): Promise<void>;
}
