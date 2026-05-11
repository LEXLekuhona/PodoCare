/* eslint-disable import/order */
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@srs/shared-types';

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { Roles } from '../../auth/infrastructure/roles.decorator';
import { RolesGuard } from '../../auth/infrastructure/roles.guard';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { ReviewsService } from '../application/reviews.service';
// Nest ValidationPipe relies on runtime metadata for DTO classes.
// `import type` breaks `design:paramtypes`, causing whitelist validation to reject all properties.
import type { CreateReviewDto } from './dto/create-review.dto';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @Roles(UserRole.Client)
  @ApiOperation({
    summary:
      'Клиент оставляет отзыв о визите/студии. Сохраняется в FeedbackSurvey; почта/звонок остаются как fallback в мобильном приложении.',
  })
  create(@CurrentUser() user: JwtAccessPayload, @Body() body: CreateReviewDto) {
    return this.reviewsService.createForClient(user.sub, body);
  }

  @Get('me')
  @Roles(UserRole.Client)
  @ApiOperation({ summary: 'Список отзывов текущего клиента (50 последних).' })
  listMine(@CurrentUser() user: JwtAccessPayload) {
    return this.reviewsService.listMine(user.sub);
  }
}
