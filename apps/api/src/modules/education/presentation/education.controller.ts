/* eslint-disable import/order */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { EducationService } from '../application/education.service';
// Nest ValidationPipe relies on runtime metadata for DTO classes.
// `import type` breaks `design:paramtypes`, causing whitelist validation to reject all properties.
/* eslint-disable @typescript-eslint/consistent-type-imports -- DTO classes for @Query() metadata */
import { EducationAudienceQueryDto } from './dto/education-audience.query.dto';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';

@ApiTags('education')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('education')
export class EducationController {
  constructor(private readonly educationService: EducationService) {}

  @Get('screen')
  @ApiOperation({
    summary: 'Экран «Обучение»: мои курсы, бесплатные материалы, полезное.',
    description:
      'Данные из БД (контент ведётся через админ-панель). Если выдача пуста и EDUCATION_STATIC_FALLBACK≠false — встроенный демо-каталог для разработки.',
  })
  getScreen(@CurrentUser() user: JwtAccessPayload, @Query() q: EducationAudienceQueryDto) {
    return this.educationService.getScreen(user.sub, q.audience ?? 'client');
  }
}
