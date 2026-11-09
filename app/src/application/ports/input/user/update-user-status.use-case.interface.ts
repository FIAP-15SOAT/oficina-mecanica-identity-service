import { UserPublicView } from '@domain/entities/user.entity';

export interface IUpdateUserStatusUseCase {
  execute(id: string, active: boolean): Promise<UserPublicView>;
}
