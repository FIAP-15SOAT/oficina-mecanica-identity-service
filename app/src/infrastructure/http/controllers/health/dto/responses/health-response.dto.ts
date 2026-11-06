import { ApiProperty } from '@nestjs/swagger';

import { HEALTHY_BODY, UNAVAILABLE_BODY } from '@infrastructure/health/health.constants';

export class HealthyResponseDto {
  @ApiProperty({
    enum: [HEALTHY_BODY.status],
    example: HEALTHY_BODY.status,
    description: 'Resultado da verificação',
  })
  status!: typeof HEALTHY_BODY.status;
}

export class UnavailableResponseDto {
  @ApiProperty({
    enum: [UNAVAILABLE_BODY.status],
    example: UNAVAILABLE_BODY.status,
    description: 'Resultado da verificação',
  })
  status!: typeof UNAVAILABLE_BODY.status;
}
