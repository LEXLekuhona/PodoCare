import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class QuizAdminOptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text!: string;

  @IsInt()
  scoreDelta!: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsUUID()
  @IsOptional()
  nextQuestionId?: string;
}

class QuizAdminQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text!: string;

  @IsInt()
  @Min(0)
  order!: number;

  @IsIn(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'YES_NO'])
  @IsOptional()
  type?: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'YES_NO';

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => QuizAdminOptionDto)
  options!: QuizAdminOptionDto[];
}

class QuizAdminOutcomeDto {
  @IsString()
  @IsNotEmpty()
  segment!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  description!: string;

  @IsInt()
  @Min(0)
  minScore!: number;

  @IsInt()
  @Min(0)
  maxScore!: number;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsString()
  @IsOptional()
  primaryCtaLabel?: string;

  @IsString()
  @IsOptional()
  primaryCtaTarget?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  recommendedContentIds?: string[];
}

export class CreateQuizAdminDto {
  @IsUUID()
  networkId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1500)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizAdminQuestionDto)
  questions!: QuizAdminQuestionDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizAdminOutcomeDto)
  outcomes!: QuizAdminOutcomeDto[];
}

export type QuizAdminQuestionInput = QuizAdminQuestionDto;
export type QuizAdminOutcomeInput = QuizAdminOutcomeDto;
