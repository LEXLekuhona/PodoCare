import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { FaqService } from '../application/faq.service';

@ApiTags('faq')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  @Get()
  @ApiOperation({ summary: 'FAQ для главного экрана и справки.' })
  list() {
    return this.faqService.list();
  }
}

