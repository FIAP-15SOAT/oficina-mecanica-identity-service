import { EnsureCustomerUserDto, EnsureCustomerUserOutputDto } from './dto/ensure-customer-user.dto';

export interface IEnsureCustomerUserUseCase {
  execute(input: EnsureCustomerUserDto): Promise<EnsureCustomerUserOutputDto>;
}
