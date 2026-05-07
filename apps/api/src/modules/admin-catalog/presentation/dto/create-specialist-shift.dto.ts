import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches } from 'class-validator';

const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export class CreateSpecialistShiftDto {
  @ApiProperty({ description: 'Студия, в которой проходит смена' })
  @IsUUID()
  studioId!: string;

  @ApiProperty({
    description:
      'Начало смены в локальном времени студии (datetime-local), например 2026-05-07T10:00',
  })
  @IsString()
  @Matches(DATETIME_LOCAL_RE)
  startsAtLocal!: string;

  @ApiProperty({
    description:
      'Конец смены в локальном времени студии (datetime-local), например 2026-05-07T19:00',
  })
  @IsString()
  @Matches(DATETIME_LOCAL_RE)
  endsAtLocal!: string;
}
