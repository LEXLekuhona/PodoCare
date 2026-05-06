import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM_RE = /^\d{2}:\d{2}$/;

export class CreateSpecialistShiftsBulkDto {
  @ApiProperty({ description: 'Студия, в которой создаются смены' })
  @IsUUID()
  studioId!: string;

  @ApiProperty({ description: 'Дата начала периода (YYYY-MM-DD)' })
  @IsString()
  @Matches(ISO_DATE_RE)
  fromDate!: string;

  @ApiProperty({ description: 'Дата конца периода (YYYY-MM-DD)' })
  @IsString()
  @Matches(ISO_DATE_RE)
  toDate!: string;

  @ApiProperty({ description: 'Дни недели (0=ВС ... 6=СБ)', type: [Number], example: [1, 2, 3, 4, 5] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays!: number[];

  @ApiProperty({ description: 'Время начала локально в студии (HH:mm)', example: '10:00' })
  @IsString()
  @Matches(HH_MM_RE)
  startsAtLocal!: string;

  @ApiProperty({ description: 'Время окончания локально в студии (HH:mm)', example: '19:00' })
  @IsString()
  @Matches(HH_MM_RE)
  endsAtLocal!: string;
}
