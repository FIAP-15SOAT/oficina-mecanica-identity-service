export interface IIssuePasswordResetCodeUseCase {
  execute(userId: string, actingUserId: string): Promise<void>;
}
