import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

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

  @ApiPropertyOptional({ description: 'Горизонт в календарных днях (от «сегодня» по TZ студии)', default: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  days?: number;
}
