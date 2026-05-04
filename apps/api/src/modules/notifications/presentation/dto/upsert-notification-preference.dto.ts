import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class UpsertNotificationPreferenceDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsBoolean()
  marketingSmsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingPushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingEmailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  newContentPushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  reminderSmsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  reminderPushEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Length(5, 5)
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  @Length(5, 5)
  quietHoursEnd?: string;
}
