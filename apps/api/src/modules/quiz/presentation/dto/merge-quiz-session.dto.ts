import { IsString, IsOptional, MaxLength } from 'class-validator';

export class MergeQuizSessionDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  anonToken?: string;
}
