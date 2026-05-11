import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SearchWalkInClientsQueryDto {
  @ApiProperty()
  @IsUUID()
  studioId!: string;

  @ApiPropertyOptional({
    description: 'Телефон или часть ФИО (от 2 символов). Телефон нормализуется на сервере.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  q?: string;
}
