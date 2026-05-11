import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class StaffUpdateClientMedicalCardDto {
  @ApiProperty({ description: 'Запись, в рамках которой открыта медкарта (проверка доступа к студии).' })
  @IsUUID()
  appointmentId!: string;

  @ApiProperty({
    description: 'Дата рождения YYYY-MM-DD; пустая строка — очистить.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  birthDate?: string;

  @ApiProperty({ required: false, description: 'Пустая строка — очистить поле в карте.' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  allergies?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  chronicConditions?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  contraindications?: string;
}
