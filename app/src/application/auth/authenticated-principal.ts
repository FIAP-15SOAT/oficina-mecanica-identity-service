import { UserRole } from '@domain/enums/user-role.enum';

/** Staff principal set by the Passport strategy that validated the token. */
export type AuthenticatedPrincipal = { sub: string; email: string; role: UserRole };
