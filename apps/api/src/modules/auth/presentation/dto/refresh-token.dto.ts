import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh JWT token.' })
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}
