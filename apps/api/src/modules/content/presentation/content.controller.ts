/* eslint-disable import/order */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@srs/shared-types';

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { Roles } from '../../auth/infrastructure/roles.decorator';
import { RolesGuard } from '../../auth/infrastructure/roles.guard';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { ContentService } from '../application/content.service';
// Nest ValidationPipe relies on runtime metadata for DTO classes.
// `import type` breaks `design:paramtypes`, causing whitelist validation to reject all properties.
import type { CreateClientContentProgressDto } from './dto/create-client-content-progress.dto';
import type { CreateContentCtaDto } from './dto/create-content-cta.dto';
import type { CreateContentItemDto } from './dto/create-content-item.dto';
import type { CreateContentSeriesDto } from './dto/create-content-series.dto';
import type { ListContentSeriesQueryDto } from './dto/list-content-series.query.dto';
import type { UpdateContentCtaDto } from './dto/update-content-cta.dto';
import type { UpdateContentItemDto } from './dto/update-content-item.dto';
import type { UpdateContentSeriesDto } from './dto/update-content-series.dto';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';

const CONTENT_ADMIN_ROLES = [
  UserRole.ContentAuthor,
  UserRole.NetworkOwner,
  UserRole.StudioAdmin,
  UserRole.SuperAdmin,
] as const;

@ApiTags('content')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('content/feed')
  @Get('feed')
  @ApiOperation({ summary: 'Лента контента для главного экрана (превью).' })
  feed(@CurrentUser() user: JwtAccessPayload) {
    return this.contentService.feed(user.sub);
  }

  @Post('content/series')
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Создать серию контента.' })
  createSeries(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateContentSeriesDto) {
    return this.contentService.createSeries(user, dto);
  }

  @Get('content/series')
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Список серий контента.' })
  listSeries(@CurrentUser() user: JwtAccessPayload, @Query() q: ListContentSeriesQueryDto) {
    return this.contentService.listSeries(user, q);
  }

  @Patch('content/series/:id')
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Обновить серию контента.' })
  updateSeries(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentSeriesDto,
  ) {
    return this.contentService.updateSeries(user, id, dto);
  }

  @Post('content/items')
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Создать единицу контента.' })
  createItem(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateContentItemDto) {
    return this.contentService.createItem(user, dto);
  }

  @Patch('content/items/:id')
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Обновить единицу контента.' })
  updateItem(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentItemDto,
  ) {
    return this.contentService.updateItem(user, id, dto);
  }

  @Post('content/items/:id/publish')
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Опубликовать единицу контента и поставить push для релевантной аудитории.' })
  publishItem(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.contentService.publishItem(user, id);
  }

  @Post('content/items/:id/cta')
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Создать CTA для единицы контента.' })
  createItemCta(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateContentCtaDto,
  ) {
    return this.contentService.createItemCta(user, id, dto);
  }

  @Patch('content/items/:id/cta/:ctaId')
  @Roles(...CONTENT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Обновить CTA единицы контента.' })
  updateItemCta(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ctaId', ParseUUIDPipe) ctaId: string,
    @Body() dto: UpdateContentCtaDto,
  ) {
    return this.contentService.updateItemCta(user, id, ctaId, dto);
  }

  @Get('client/content/feed')
  @Roles(UserRole.Client)
  @ApiOperation({ summary: 'Лента контента для клиента.' })
  clientFeed(@CurrentUser() user: JwtAccessPayload) {
    return this.contentService.getClientFeed(user.sub);
  }

  @Get('client/content/items/:id')
  @Roles(UserRole.Client)
  @ApiOperation({ summary: 'Детальный материал для экрана чтения клиентом.' })
  getClientItem(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contentService.getClientItem(user.sub, id);
  }

  @Post('client/content/items/:id/progress')
  @Roles(UserRole.Client)
  @ApiOperation({ summary: 'Сохранить прогресс клиента по единице контента.' })
  saveProgress(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClientContentProgressDto,
  ) {
    return this.contentService.saveClientProgress(user.sub, id, dto);
  }

  @Post('client/content/items/:id/cta/:ctaId/click')
  @Roles(UserRole.Client)
  @ApiOperation({ summary: 'Зафиксировать CTA-click клиента.' })
  clickCta(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ctaId', ParseUUIDPipe) ctaId: string,
  ) {
    return this.contentService.clickClientCta(user.sub, id, ctaId);
  }
}

