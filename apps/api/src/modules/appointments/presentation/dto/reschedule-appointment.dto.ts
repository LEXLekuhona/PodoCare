import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';

export class RescheduleAppointmentDto {
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
