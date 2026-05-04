import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';

export class ListAppointmentsQueryDto {
  @IsOptional()
  @IsUUID('loose')
  studioId?: string;

  @IsOptional()
  @IsUUID('loose')
  specialistId?: string;

  @IsOptional()
  @IsUUID('loose')
  clientUserId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
