import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateUserStatusRequestDto {
  @ApiProperty({
    example: true,
    description: 'Indica o status do usuário',
  })
  @IsBoolean({ message: 'active deve ser um booleano' })
  active!: boolean;
}
