import { User } from '@domain/entities/user.entity';
import { PasswordGenerator } from '@domain/services/password-generator';
import { IUnitOfWork } from '@domain/interfaces/repositories/unit-of-work.interface';

import { IHashService } from '@application/ports/output/services/hash.service.interface';
import { ICreateUserUseCase } from '@application/ports/input/user/create-user.use-case.interface';
import {
  CreateUserDto,
  CreateUserOutputDto,
} from '@application/ports/input/user/dto/create-user.dto';
import { ResourceConflictException } from '@application/exceptions/resource-conflict.exception';
import { AccountEmailComposer } from '@application/notifications/account-email.composer';

export class CreateUserUseCase implements ICreateUserUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly hashService: IHashService,
  ) {}

  async execute(createUserDto: CreateUserDto): Promise<CreateUserOutputDto> {
    const email = createUserDto.email.trim().toLowerCase();

    if (await this.findUserByEmail(email)) {
      throw new ResourceConflictException('E-mail já cadastrado no sistema');
    }

    const generatedPassword = PasswordGenerator.generate();
    const passwordHash = await this.hashService.hash(generatedPassword);

    const user = User.create({
      name: createUserDto.name,
      email: createUserDto.email,
      passwordHash,
      role: createUserDto.role,
      cpf: createUserDto.cpf,
    });

    return this.unitOfWork.executeTransaction(async (repos) => {
      const created = await repos.user.create(user);

      await repos.outbox.add(
        AccountEmailComposer.staffInitialPassword({
          toEmail: created.email.value,
          toName: created.name,
          password: generatedPassword,
        }),
      );

      return created.toPublicView();
    });
  }

  private findUserByEmail(email: string): Promise<User | null> {
    return this.unitOfWork.executeTransaction((repos) => repos.user.findByEmail(email));
  }
}
