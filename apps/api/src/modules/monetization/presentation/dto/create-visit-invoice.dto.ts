import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class VisitInvoiceLineDto {
  @ApiProperty({ enum: ProductType, enumName: 'ProductType' })
  @IsIn([ProductType.SERVICE, ProductType.PHYSICAL_GOOD])
  productType!: ProductType;

  @ApiPropertyOptional({ description: 'Для услуги' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Для товара' })
  @IsOptional()
  @IsUUID()
  physicalGoodId?: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateVisitInvoiceDto {
  @ApiProperty()
  @IsUUID()
  appointmentId!: string;

  @ApiProperty({ type: [VisitInvoiceLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VisitInvoiceLineDto)
  items!: VisitInvoiceLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customerNote?: string;
}
