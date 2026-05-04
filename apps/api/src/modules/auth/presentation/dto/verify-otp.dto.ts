import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '+79991234567' })
  @IsString()
  @Length(10, 20)
  @Matches(/^[+\d\s()-]+$/)
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 8)
  @Matches(/^\d+$/)
  code!: string;

  @ApiProperty({
    example: 'mobile_ios',
    description: 'Тип устройства для сессии: mobile_ios, mobile_android, tablet_ios и т.д.',
  })
  @IsString()
  @MaxLength(50)
  deviceType!: string;

  @ApiPropertyOptional({ example: '203.0.113.42' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ipAddress?: string;

  @ApiPropertyOptional({
    example:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;

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
