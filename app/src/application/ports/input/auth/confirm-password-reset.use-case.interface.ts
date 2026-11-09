import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';

export interface IConfirmPasswordResetUseCase {
  execute(dto: ConfirmPasswordResetDto): Promise<void>;
}
