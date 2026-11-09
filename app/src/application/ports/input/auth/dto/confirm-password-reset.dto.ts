export interface ConfirmPasswordResetDto {
  email: string;
  code: string;
  newPassword: string;
}
