import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @Length(1, 60)
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  lastName?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Email или пустая строка для сброса.',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Дата рождения YYYY-MM-DD или пустая строка для сброса.',
    example: '1990-04-15',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  birthDate?: string;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Аватар: https URL или data:image/jpeg|png|webp;base64,... Пустая строка — убрать фото.',
    maxLength: 600000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(600000)
  avatarUrl?: string;
}

