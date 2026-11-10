export interface AuthenticateCustomerCredentialDto {
  cpf: string;
  password: string;
}

export interface AuthenticateCustomerCredentialOutputDto {
  userId: string;
}
