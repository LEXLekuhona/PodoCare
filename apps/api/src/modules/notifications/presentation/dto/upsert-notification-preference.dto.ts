import { IsBoolean, IsOptional, IsString, IsUUID, Length, ValidateIf } from 'class-validator';

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
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Length(5, 5)
  quietHoursStart?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @Length(5, 5)
  quietHoursEnd?: string | null;
}
