import { UserRole } from '@domain/enums/user-role.enum';
import { User } from '@domain/entities/user.entity';
import { DomainValidationException } from '@domain/exceptions/domain-validation.exception';
import { PASSWORD_REQUIREMENTS_MESSAGE } from '@domain/constants/validation/user.constants';
import { Email } from '@domain/value-objects/email.vo';

describe('User Entity', () => {
  const validProps = {
    name: 'Usuario Teste',
    email: 'usuario@email.com',
    passwordHash: '$2b$12$hashedpassword',
    role: UserRole.ATTENDANT,
  };

  describe('create (factory method)', () => {
    it('should create a valid user', () => {
      const user = User.create(validProps);

      expect(user.name).toBe('Usuario Teste');
      expect(user.email.value).toBe('usuario@email.com');
      expect(user.passwordHash).toBe(validProps.passwordHash);
      expect(user.role).toBe(UserRole.ATTENDANT);
      expect(user.isActive).toBe(true);
    });

    it('should create with specific role', () => {
      const user = User.create({ ...validProps, role: UserRole.ADMIN });

      expect(user.role).toBe(UserRole.ADMIN);
    });

    it('should normalize email to lowercase and trim', () => {
      const user = User.create({ ...validProps, email: '  USUARIO@Email.COM  ' });

      expect(user.email.value).toBe('usuario@email.com');
    });

    it('should trim name', () => {
      const user = User.create({ ...validProps, name: '  Usuario Teste  ' });

      expect(user.name).toBe('Usuario Teste');
    });

    it('should throw error if name is too short', () => {
      expect(() => User.create({ ...validProps, name: 'Ab' })).toThrow(DomainValidationException);
      expect(() => User.create({ ...validProps, name: 'Ab' })).toThrow(
        'Nome deve ter no mínimo 3 caracteres',
      );
    });

    it('should throw error if name is too long', () => {
      const longName = 'A'.repeat(151);

      expect(() => User.create({ ...validProps, name: longName })).toThrow(
        DomainValidationException,
      );
      expect(() => User.create({ ...validProps, name: longName })).toThrow(
        'Nome deve ter no máximo 150 caracteres',
      );
    });

    it('should throw error if email is invalid', () => {
      expect(() => User.create({ ...validProps, email: 'invalido' })).toThrow(
        DomainValidationException,
      );
      expect(() => User.create({ ...validProps, email: 'invalido' })).toThrow('E-mail inválido');
    });

    it('should throw error if email is empty', () => {
      expect(() => User.create({ ...validProps, email: '' })).toThrow(DomainValidationException);
    });

    it('should throw error if email exceeds 150 characters', () => {
      const longEmail = 'a'.repeat(142) + '@test.com';

      expect(() => User.create({ ...validProps, email: longEmail })).toThrow(
        'E-mail deve ter no máximo 150 caracteres',
      );
    });

    it('should throw error if passwordHash is empty', () => {
      expect(() => User.create({ ...validProps, passwordHash: '' })).toThrow(
        DomainValidationException,
      );
      expect(() => User.create({ ...validProps, passwordHash: '' })).toThrow(
        'Hash de senha não pode ser vazio',
      );
    });

    it('should throw error if role is invalid', () => {
      expect(() => User.create({ ...validProps, role: 'InvalidRole' as UserRole })).toThrow(
        DomainValidationException,
      );
      expect(() => User.create({ ...validProps, role: 'InvalidRole' as UserRole })).toThrow(
        'Role inválida',
      );
    });
  });

  describe('changeName', () => {
    it('should change name successfully', () => {
      const user = User.create(validProps);
      user.changeName('Guilherme Salvador');

      expect(user.name).toBe('Guilherme Salvador');
    });

    it('should trim new name', () => {
      const user = User.create(validProps);
      user.changeName('  Lucas Almeida  ');

      expect(user.name).toBe('Lucas Almeida');
    });

    it('should throw error if name is too short', () => {
      const user = User.create(validProps);

      expect(() => user.changeName('Ab')).toThrow(DomainValidationException);
    });
  });

  describe('changeEmail', () => {
    it('should change email and normalize', () => {
      const user = User.create(validProps);
      user.changeEmail('NOVO@Email.COM');

      expect(user.email.value).toBe('novo@email.com');
    });

    it('should throw error if email is invalid', () => {
      const user = User.create(validProps);

      expect(() => user.changeEmail('invalido')).toThrow(DomainValidationException);
    });
  });

  describe('changeRole', () => {
    it('should change role successfully', () => {
      const user = User.create(validProps);
      user.changeRole(UserRole.MECHANIC);

      expect(user.role).toBe(UserRole.MECHANIC);
    });

    it('should throw error for invalid role', () => {
      const user = User.create(validProps);

      expect(() => user.changeRole('InvalidRole' as UserRole)).toThrow(DomainValidationException);
      expect(() => user.changeRole('InvalidRole' as UserRole)).toThrow('Role inválida');
    });
  });

  describe('changePassword', () => {
    it('should change password hash', () => {
      const user = User.create(validProps);
      user.changePassword('$2b$12$newhash');

      expect(user.passwordHash).toBe('$2b$12$newhash');
    });

    it('should throw error if hash is empty', () => {
      const user = User.create(validProps);

      expect(() => user.changePassword('')).toThrow(DomainValidationException);
      expect(() => user.changePassword('')).toThrow('Hash de senha não pode ser vazio');
    });

    it('should update passwordChangedAt so tokens issued before this point stop being honored', () => {
      const user = User.create(validProps);
      const previousPasswordChangedAt = user.passwordChangedAt;

      user.changePassword('$2b$12$newhash');

      expect(user.passwordChangedAt.getTime()).toBeGreaterThanOrEqual(
        previousPasswordChangedAt.getTime(),
      );
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept a strong password', () => {
      expect(() => User.validatePasswordStrength('Senha@123')).not.toThrow();
      expect(() => User.validatePasswordStrength('Tech@2026')).not.toThrow();
    });

    it('should throw if password is shorter than 8 characters', () => {
      expect(() => User.validatePasswordStrength('Ab@1cd')).toThrow(DomainValidationException);
      expect(() => User.validatePasswordStrength('Ab@1cd')).toThrow(PASSWORD_REQUIREMENTS_MESSAGE);
    });

    it('should throw if password has no uppercase letter', () => {
      expect(() => User.validatePasswordStrength('senha@123')).toThrow(
        PASSWORD_REQUIREMENTS_MESSAGE,
      );
    });

    it('should throw if password has no lowercase letter', () => {
      expect(() => User.validatePasswordStrength('SENHA@123')).toThrow(
        PASSWORD_REQUIREMENTS_MESSAGE,
      );
    });

    it('should throw if password has no digit', () => {
      expect(() => User.validatePasswordStrength('Senha@abc')).toThrow(
        PASSWORD_REQUIREMENTS_MESSAGE,
      );
    });

    it('should throw if password has no special character', () => {
      expect(() => User.validatePasswordStrength('Senha1234')).toThrow(
        PASSWORD_REQUIREMENTS_MESSAGE,
      );
    });

    it('should throw if password is empty', () => {
      expect(() => User.validatePasswordStrength('')).toThrow(DomainValidationException);
    });
  });

  describe('activate / deactivate', () => {
    it('should deactivate an active user', () => {
      const user = User.create(validProps);

      expect(user.isActive).toBe(true);

      user.deactivate();

      expect(user.isActive).toBe(false);
    });

    it('should activate a deactivated user', () => {
      const user = User.create(validProps);
      user.deactivate();
      user.activate();

      expect(user.isActive).toBe(true);
    });

    it('should throw error when activating already active user', () => {
      const user = User.create(validProps);

      expect(() => user.activate()).toThrow(DomainValidationException);
      expect(() => user.activate()).toThrow('Usuário já está ativo');
    });

    it('should throw error when deactivating already deactivated user', () => {
      const user = User.create(validProps);
      user.deactivate();

      expect(() => user.deactivate()).toThrow(DomainValidationException);
      expect(() => user.deactivate()).toThrow('Usuário já está desativado');
    });
  });

  describe('toPublicView', () => {
    it('should return public view without passwordHash', () => {
      const now = new Date();

      const user = User.reconstitute({
        id: 'uuid-123',
        name: 'Usuario Teste',
        email: Email.create('usuario@email.com'),
        passwordHash: 'secret-hash',
        role: UserRole.ADMIN,
        cpf: null,
        isActive: true,
        passwordChangedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const view = user.toPublicView();

      expect(view).toEqual({
        id: 'uuid-123',
        name: 'Usuario Teste',
        email: 'usuario@email.com',
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      expect(view).not.toHaveProperty('passwordHash');
    });
  });

  describe('create with cpf and null role', () => {
    it('should create an externally-only user with role null', () => {
      const user = User.create({ ...validProps, role: null });

      expect(user.role).toBeNull();
    });

    it('should create a user with a valid cpf', () => {
      const user = User.create({ ...validProps, cpf: '12345678909' });

      expect(user.cpf?.value).toBe('12345678909');
    });

    it('should normalize a formatted cpf to digits only', () => {
      const user = User.create({ ...validProps, cpf: '123.456.789-09' });

      expect(user.cpf?.value).toBe('12345678909');
    });

    it('should default cpf to null when not provided', () => {
      const user = User.create(validProps);

      expect(user.cpf).toBeNull();
    });

    it('should throw for an invalid cpf', () => {
      expect(() => User.create({ ...validProps, cpf: '11111111111' })).toThrow(
        DomainValidationException,
      );
      expect(() => User.create({ ...validProps, cpf: '11111111111' })).toThrow('CPF inválido');
    });

    it('should throw when cpf is provided but contains no digits', () => {
      expect(() => User.create({ ...validProps, cpf: 'abc' })).toThrow(DomainValidationException);
      expect(() => User.create({ ...validProps, cpf: 'abc' })).toThrow('CPF inválido');
    });
  });
});
