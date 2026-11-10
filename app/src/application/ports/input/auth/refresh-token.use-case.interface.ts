import {
  RefreshTokenInputDto,
  RefreshTokenOutputDto,
} from '@application/ports/input/auth/dto/refresh-token.dto';

export interface IRefreshTokenUseCase {
  execute(input: RefreshTokenInputDto): Promise<RefreshTokenOutputDto>;
}
