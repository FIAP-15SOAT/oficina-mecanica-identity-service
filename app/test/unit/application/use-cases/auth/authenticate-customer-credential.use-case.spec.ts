import { UserRole } from '@domain/enums/user-role.enum';
import { IUserRepository } from '@domain/interfaces/repositories/user.repository.interface';
import { Cpf } from '@domain/value-objects/cpf.vo';

import { UnauthorizedAccessException } from '@application/exceptions/unauthorized-access.exception';
import { BUSINESS_EVENTS } from '@application/logging/business-event.catalog';
import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { ILogger } from '@application/ports/output/services/logger.service.interface';
import { AuthenticateCustomerCredentialUseCase } from '@application/use-cases/auth/authenticate-customer-credential.use-case';

import { createMockHashService } from '../../../../helpers/hash-mock.factory';
import { createMockLogger } from '../../../../helpers/logger-mock.factory';
import { createMockUser, createMockUserRepository } from '../../../../helpers/user-mock.factory';

describe('AuthenticateCustomerCredentialUseCase', () => {
  let useCase: AuthenticateCustomerCredentialUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let hashService: jest.Mocked<IHashService>;
  let logger: jest.Mocked<ILogger>;

  const cpf = Cpf.create('12345678909');

  beforeEach(() => {
    userRepository = createMockUserRepository();
    hashService = createMockHashService();
    logger = createMockLogger();

    useCase = new AuthenticateCustomerCredentialUseCase(userRepository, hashService, logger);
  });

  it('should return the user id when the credential matches', async () => {
    const user = createMockUser({ cpf, role: null });
    userRepository.findByCpf.mockResolvedValue(user);

    const result = await useCase.execute({ cpf: '123.456.789-09', password: 'Senha@123' });

    expect(result).toEqual({ userId: user.id });
    expect(userRepository.findByCpf).toHaveBeenCalledWith('12345678909');
    expect(hashService.compare).toHaveBeenCalledWith('Senha@123', user.passwordHash);

    expect(logger.event).toHaveBeenCalledWith(BUSINESS_EVENTS.CUSTOMER_CREDENTIAL_ACCEPTED, {
      subjectId: user.id,
      subjectName: user.name,
      subjectEmail: user.email.value,
    });
  });

  it('should accept a user with an internal role', async () => {
    const user = createMockUser({ cpf, role: UserRole.ADMIN });
    userRepository.findByCpf.mockResolvedValue(user);

    const result = await useCase.execute({ cpf: '12345678909', password: 'Senha@123' });

    expect(result).toEqual({ userId: user.id });
  });

  it.each([
    ['a CPF with an invalid check digit', 'invalid_cpf', '123.456.789-00', null, true],
    ['a CPF with repeated digits', 'invalid_cpf', '111.111.111-11', null, true],
    ['a CPF without user', 'unknown_user', '12345678909', null, true],
    ['an inactive user', 'inactive_user', '12345678909', { isActive: false }, true],
    ['a wrong password', 'wrong_password', '12345678909', {}, false],
  ])(
    'should return 401 with the same message for %s',
    async (_case, failureReason, rawCpf, userOverrides, passwordMatches) => {
      userRepository.findByCpf.mockResolvedValue(
        userOverrides === null ? null : createMockUser({ cpf, ...userOverrides }),
      );
      hashService.compare.mockResolvedValue(passwordMatches);

      await expect(useCase.execute({ cpf: rawCpf, password: 'Senha@123' })).rejects.toThrow(
        new UnauthorizedAccessException('Credenciais inválidas'),
      );

      expect(logger.event).toHaveBeenCalledWith(
        BUSINESS_EVENTS.AUTHENTICATION_FAILED,
        expect.objectContaining({ failureReason }),
      );

      expect(logger.event).not.toHaveBeenCalledWith(
        BUSINESS_EVENTS.CUSTOMER_CREDENTIAL_ACCEPTED,
        expect.anything(),
      );
    },
  );

  it('should not look up nor compare anything for an invalid CPF', async () => {
    await expect(useCase.execute({ cpf: '123', password: 'Senha@123' })).rejects.toThrow(
      UnauthorizedAccessException,
    );

    expect(userRepository.findByCpf).not.toHaveBeenCalled();
    expect(hashService.compare).not.toHaveBeenCalled();
  });

  it('should propagate an error that is not a domain validation failure', async () => {
    await expect(
      useCase.execute({ cpf: undefined as unknown as string, password: 'Senha@123' }),
    ).rejects.toThrow(TypeError);

    expect(userRepository.findByCpf).not.toHaveBeenCalled();
  });
});
