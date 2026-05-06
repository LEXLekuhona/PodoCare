import { AppointmentSource } from '@srs/shared-types';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAppointmentDto {
  @IsUUID('loose')
  studioId!: string;

  @IsUUID('loose')
  specialistId!: string;

  @IsUUID('loose')
  serviceId!: string;

  @IsOptional()
  @IsUUID('loose')
  clientUserId?: string;

  @IsOptional()
  @IsUUID('loose')
  walkInClientId?: string;

  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @IsOptional()
  @IsEnum(AppointmentSource)
  source?: AppointmentSource;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialistNote?: string;
}
