import { defineLogEvent } from './log-event';

export type AuthenticationFailureReason =
  | 'unknown_user'
  | 'inactive_user'
  | 'wrong_password'
  | 'no_internal_role';

export type RefreshFailureReason =
  | 'invalid_token'
  | 'unknown_user'
  | 'inactive_user'
  | 'no_internal_role'
  | 'password_changed';

interface AuthenticatedSubjectFields {
  subjectId: string;
  subjectName: string;
  subjectEmail: string;
}

export const BUSINESS_EVENTS = {
  AUTHENTICATION_SUCCEEDED: defineLogEvent<AuthenticatedSubjectFields>({
    name: 'auth.authentication.succeeded',
    message: 'credentials accepted and token pair issued',
    level: 'info',
  }),
  AUTHENTICATION_FAILED: defineLogEvent<
    Partial<AuthenticatedSubjectFields> & { failureReason: AuthenticationFailureReason }
  >({
    name: 'auth.authentication.failed',
    message: 'credentials rejected',
    level: 'warn',
  }),
  REFRESH_TOKEN_FAILED: defineLogEvent<
    Partial<AuthenticatedSubjectFields> & { failureReason: RefreshFailureReason }
  >({
    name: 'auth.refresh.failed',
    message: 'refresh token rejected',
    level: 'warn',
  }),
  USER_STATUS_UPDATED: defineLogEvent<{ targetUserId: string; targetUserActive: boolean }>({
    name: 'user.status.updated',
    message: 'user account activation changed',
    level: 'info',
  }),
  USER_PASSWORD_CHANGED: defineLogEvent<{ subjectId: string }>({
    name: 'user.password.changed',
    message: 'user changed their own password',
    level: 'info',
  }),
  USER_PASSWORD_RESET_ISSUED: defineLogEvent<{ subjectId: string; targetUserId: string }>({
    name: 'user.password_reset.issued',
    message: 'admin issued a password reset code',
    level: 'info',
  }),
  USER_PASSWORD_RESET_COMPLETED: defineLogEvent<{
    targetUserId: string;
    resetOutcome: string;
  }>({
    name: 'user.password_reset.completed',
    message: 'password reset confirmed with a valid code',
    level: 'info',
  }),
  USER_PASSWORD_RESET_REJECTED: defineLogEvent<{ resetOutcome: string }>({
    name: 'user.password_reset.rejected',
    message: 'password reset confirmation rejected',
    level: 'warn',
  }),
} as const;
