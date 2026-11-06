import { UserRole } from '@domain/enums/user-role.enum';
import { ROLES_KEY, Roles } from '@infrastructure/http/decorators/roles.decorator';

class TestController {
  @Roles(UserRole.ADMIN, UserRole.MECHANIC)
  handler(): void {}
}

describe('Roles decorator', () => {
  it('should store the required roles under the roles metadata key', () => {
    expect(Reflect.getMetadata(ROLES_KEY, TestController.prototype.handler)).toEqual([
      UserRole.ADMIN,
      UserRole.MECHANIC,
    ]);
  });
});
