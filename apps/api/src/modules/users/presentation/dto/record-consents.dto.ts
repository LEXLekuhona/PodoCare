import { ApiProperty } from '@nestjs/swagger';
import { ConsentType } from '@srs/shared-types';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsString, Length, ValidateNested } from 'class-validator';

export class RecordConsentItemDto {
  @ApiProperty({ enum: ConsentType })
  @IsEnum(ConsentType)
  type!: ConsentType;

  @ApiProperty({ example: '1.2' })
  @IsString()
  @Length(1, 32)
  documentVersion!: string;
}

export class RecordConsentsDto {
  @ApiProperty({ type: [RecordConsentItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecordConsentItemDto)
  items!: RecordConsentItemDto[];
}
