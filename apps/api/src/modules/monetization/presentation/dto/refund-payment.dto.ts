import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class RefundPaymentDto {
  @ApiPropertyOptional({ description: 'Сумма возврата в копейках; по умолчанию полный остаток' })
  @IsOptional()
  @IsInt()
  @Min(1)
  amountMinor?: number;
}
