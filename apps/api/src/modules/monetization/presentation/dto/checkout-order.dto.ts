import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryMethod, ProductType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CheckoutOrderItemDto {
  @ApiProperty({ enum: ProductType })
  @IsEnum(ProductType)
  productType!: ProductType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  physicalGoodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contentSeriesId?: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CheckoutOrderDto {
  @ApiPropertyOptional({ description: 'Студия (нужна для физтоваров / самовывоза)' })
  @IsOptional()
  @IsUUID()
  studioId?: string;

  @ApiProperty({ type: [CheckoutOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutOrderItemDto)
  items!: CheckoutOrderItemDto[];

  @ApiPropertyOptional({ enum: DeliveryMethod })
  @IsOptional()
  @IsEnum(DeliveryMethod)
  deliveryMethod?: DeliveryMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  shippingAddressId?: string;

  @ApiPropertyOptional({ description: 'Доставка в минорных единицах' })
  @IsOptional()
  @IsInt()
  @Min(0)
  shippingMinor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  appliedPromoCodeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  programInquiryId?: string;
}
