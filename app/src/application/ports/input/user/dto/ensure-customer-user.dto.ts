export interface EnsureCustomerUserDto {
  name: string;
  email: string;
  cpf: string;
}

export interface EnsureCustomerUserOutputDto {
  userId: string;
  created: boolean;
}
