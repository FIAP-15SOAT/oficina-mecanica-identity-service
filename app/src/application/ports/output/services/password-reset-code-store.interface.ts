export interface PasswordResetCodeAttempt {
  codeHash: string;
  attempts: number;
}

export interface IPasswordResetCodeStore {
  save(userId: string, codeHash: string): Promise<void>;
  // Null when the code does not exist or has expired.
  registerAttempt(userId: string): Promise<PasswordResetCodeAttempt | null>;
  delete(userId: string): Promise<void>;
}
