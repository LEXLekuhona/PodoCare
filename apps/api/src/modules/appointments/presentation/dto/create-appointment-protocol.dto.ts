import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAppointmentProtocolDto {
  @ApiPropertyOptional({
    description: 'Выполненные процедуры в рамках визита.',
    type: [String],
    example: ['Аппаратная обработка стопы', 'Удаление гиперкератоза'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  proceduresDone?: string[];

  @ApiPropertyOptional({ description: 'Диагноз или клинический вывод специалиста.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diagnosis?: string;

  @ApiPropertyOptional({ description: 'Какие материалы/средства были использованы.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  materialsUsed?: string;

  @ApiPropertyOptional({ description: 'Внутренняя заметка для персонала, не показывается клиенту.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  internalNote?: string;

  @ApiProperty({ description: 'Показывать ли протокол клиенту в приложении.' })
  @Type(() => Boolean)
  @IsBoolean()
  clientVisible!: boolean;

  @ApiPropertyOptional({ description: 'Причина создания/обновления записи (аудит).' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Комментарий к изменению для персонала (аудит).' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
