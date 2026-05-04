import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({
    example: '+79991234567',
    description: 'Телефон в формате E.164 или локальном формате.',
  })
  @IsString()
  @Length(10, 20)
  @Matches(/^[+\d\s()-]+$/)
  phone!: string;

  @ApiPropertyOptional({ example: 'Анна' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Иванова' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}
