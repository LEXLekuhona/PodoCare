import { IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateQuizSessionDto {
  @IsUUID()
  quizId!: string;

  @IsString()
  @MaxLength(200)
  anonToken!: string;
}
