import { UserPublicView } from '@domain/entities/user.entity';

export interface IFindUserByIdUseCase {
  execute(id: string): Promise<UserPublicView>;
}
