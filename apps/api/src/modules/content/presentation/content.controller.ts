import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { ContentService } from '../application/content.service';

@ApiTags('content')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('feed')
  @ApiOperation({ summary: 'Лента контента для главного экрана (превью).' })
  feed() {
    return this.contentService.feed();
  }
}

