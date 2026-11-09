import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '@domain/interfaces/common/pagination.interface';

export class PaginationMetaDto implements PaginationMeta {
  @ApiProperty({ description: 'Total de registros', example: 100 })
  totalRecords!: number;

  @ApiProperty({ description: 'Total de páginas', example: 10 })
  totalPages!: number;

  @ApiProperty({ description: 'Página atual', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Limite de itens por página', example: 10 })
  limit!: number;
}

export abstract class PaginatedResponseDto<T> {
  abstract data: T[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}
