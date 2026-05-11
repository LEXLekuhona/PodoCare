import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

export class BookingSlotsQueryDto {
  /** OkHttp / RN иногда добавляют `?_=` против кэша; глобальный `forbidNonWhitelisted` иначе вернёт 400. */
  @ApiHideProperty()
  @Allow()
  @IsOptional()
  _?: unknown;

  @IsUUID('loose')
  studioId!: string;

  @IsUUID('loose')
  specialistId!: string;

  @IsUUID('loose')
  serviceId!: string;

  @ApiPropertyOptional({
    description:
      'Горизонт в календарных днях: от сегодняшней даты по TZ студии, либо от `fromDate`, если она задана.',
    default: 14,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  days?: number;

  @ApiPropertyOptional({
    description:
      'Первая дата горизонта в формате yyyy-MM-dd (интерпретируется в часовом поясе студии). По умолчанию — сегодня.',
    example: '2026-05-10',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;
}
