import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InstallmentProvider } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateInstallmentRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiProperty({ enum: InstallmentProvider })
  @IsEnum(InstallmentProvider)
  provider!: InstallmentProvider;

  @ApiProperty({ description: 'Сумма в минорных единицах (копейки)' })
  @IsInt()
  @Min(100)
  amountMinor!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(120)
  termMonths!: number;
}
