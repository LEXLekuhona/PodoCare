import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsUUID } from 'class-validator';

export class CreateSpecialistShiftDto {
  @ApiProperty({ description: 'Студия, в которой проходит смена' })
  @IsUUID()
  studioId!: string;

  @ApiProperty({ description: 'Начало смены в ISO UTC, например 2026-05-07T06:00:00.000Z' })
  @IsISO8601()
  startsAt!: string;

  @ApiProperty({ description: 'Конец смены в ISO UTC, например 2026-05-07T14:00:00.000Z' })
  @IsISO8601()
  endsAt!: string;
}
