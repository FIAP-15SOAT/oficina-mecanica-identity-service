import { AuthFlow } from '@domain/enums/auth-flow.enum';
import { UserRole } from '@domain/enums/user-role.enum';

/**
 * authFlow is set by the Passport strategy that validated the token (JwtStrategy or
 * CustomerJwtStrategy), never read from the token, so it does not depend on what the client sent.
 */
export type AuthenticatedPrincipal =
  | { sub: string; authFlow: AuthFlow.INTERNAL; email: string; role: UserRole }
  | { sub: string; authFlow: AuthFlow.CUSTOMER };
