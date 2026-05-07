import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Звёзды по аспектам визита. Все поля опциональны: клиент может оставить
 * только текстовый отзыв или, наоборот, поставить только общую оценку.
 */
export class ReviewRatingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  overall?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  specialist?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  studio?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  service?: number;
}

/**
 * Тело запроса POST /reviews. Хотя бы одно из полей comment/ratings должно
 * быть заполнено — пустые отзывы отбрасываем на уровне сервиса.
 *
 * - studioId: если не указан, берётся из appointmentId или из user.studioId.
 * - appointmentId: связывает отзыв с конкретным визитом (опционально).
 * - allowPublish: согласие клиента на публикацию отзыва на витринах студии.
 */
export class CreateReviewDto {
  @IsOptional()
  @IsUUID()
  studioId?: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReviewRatingsDto)
  ratings?: ReviewRatingsDto;

  @IsOptional()
  @IsBoolean()
  allowPublish?: boolean;
}
