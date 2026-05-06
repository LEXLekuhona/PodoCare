/* eslint-disable @typescript-eslint/consistent-type-imports -- DTO используются как классы для ValidationPipe */
import {
  Body,
  Controller,
  Delete,
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
import { AdminEducationService } from '../application/admin-education.service';
import { CreateContentItemDto } from './dto/create-content-item.dto';
import { CreateContentSeriesDto } from './dto/create-content-series.dto';
import { CreateProgramDto } from './dto/create-program.dto';
import { ListContentItemQueryDto } from './dto/list-content-item.query.dto';
import { ListContentSeriesQueryDto } from './dto/list-content-series.query.dto';
import { ListProgramQueryDto } from './dto/list-program.query.dto';
import { UpdateContentItemDto } from './dto/update-content-item.dto';
import { UpdateContentSeriesDto } from './dto/update-content-series.dto';
import { UpdateProgramDto } from './dto/update-program.dto';

import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';

const ADMIN_EDUCATION_ROLES = [
  UserRole.ContentAuthor,
  UserRole.NetworkOwner,
  UserRole.SuperAdmin,
  UserRole.StudioAdmin,
] as const;

@ApiTags('admin-education')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_EDUCATION_ROLES)
@Controller('admin/education')
export class AdminEducationController {
  constructor(private readonly adminEducationService: AdminEducationService) {}

  // --- Серии ---

  @Get('series')
  @ApiOperation({ summary: 'Список серий контента' })
  listSeries(@CurrentUser() user: JwtAccessPayload, @Query() q: ListContentSeriesQueryDto) {
    return this.adminEducationService.listSeries(user, q);
  }

  @Get('series/:id')
  @ApiOperation({ summary: 'Серия по id (с материалами)' })
  getSeries(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminEducationService.getSeries(user, id);
  }

  @Post('series')
  @ApiOperation({ summary: 'Создать серию' })
  createSeries(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateContentSeriesDto) {
    return this.adminEducationService.createSeries(user, dto);
  }

  @Patch('series/:id')
  @ApiOperation({ summary: 'Обновить серию' })
  updateSeries(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentSeriesDto,
  ) {
    return this.adminEducationService.updateSeries(user, id, dto);
  }

  @Delete('series/:id')
  @ApiOperation({ summary: 'Удалить серию (каскадно материалы)' })
  deleteSeries(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminEducationService.deleteSeries(user, id);
  }

  // --- Единицы контента ---

  @Get('items')
  @ApiOperation({ summary: 'Список материалов' })
  listItems(@CurrentUser() user: JwtAccessPayload, @Query() q: ListContentItemQueryDto) {
    return this.adminEducationService.listItems(user, q);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Материал по id' })
  getItem(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminEducationService.getItem(user, id);
  }

  @Post('items')
  @ApiOperation({ summary: 'Создать материал' })
  createItem(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateContentItemDto) {
    return this.adminEducationService.createItem(user, dto);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Обновить материал' })
  updateItem(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentItemDto,
  ) {
    return this.adminEducationService.updateItem(user, id, dto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Удалить материал' })
  deleteItem(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminEducationService.deleteItem(user, id);
  }

  // --- Программы ---

  @Get('programs')
  @ApiOperation({ summary: 'Список программ' })
  listPrograms(@CurrentUser() user: JwtAccessPayload, @Query() q: ListProgramQueryDto) {
    return this.adminEducationService.listPrograms(user, q);
  }

  @Get('programs/:id')
  @ApiOperation({ summary: 'Программа по id' })
  getProgram(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminEducationService.getProgram(user, id);
  }

  @Post('programs')
  @ApiOperation({ summary: 'Создать программу' })
  createProgram(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateProgramDto) {
    return this.adminEducationService.createProgram(user, dto);
  }

  @Patch('programs/:id')
  @ApiOperation({ summary: 'Обновить программу' })
  updateProgram(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProgramDto,
  ) {
    return this.adminEducationService.updateProgram(user, id, dto);
  }

  @Delete('programs/:id')
  @ApiOperation({ summary: 'Удалить программу' })
  deleteProgram(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminEducationService.deleteProgram(user, id);
  }
}
