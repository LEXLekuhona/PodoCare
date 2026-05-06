import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class StaffLoginDto {
  @ApiProperty({ example: 'admin@solodova-recovery.local' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'S3cureP@ssw0rd' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({
    example: 'admin_web',
    description: 'Тип устройства, для которого создаётся сессия.',
  })
  @IsString()
  @MaxLength(50)
  deviceType!: string;

  @ApiPropertyOptional({ example: '203.0.113.11' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ipAddress?: string;

  @ApiPropertyOptional({
    example:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 Chrome/123.0 Safari/537.36',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  userAgent?: string;
}
