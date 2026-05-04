import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import type { EducationAudienceParam } from '../../domain/education-static-catalog';

export class EducationAudienceQueryDto {
  @ApiPropertyOptional({ enum: ['client', 'master'], description: 'Аудитория контента', default: 'client' })
  @IsOptional()
  @IsIn(['client', 'master'])
  audience?: EducationAudienceParam;
}
