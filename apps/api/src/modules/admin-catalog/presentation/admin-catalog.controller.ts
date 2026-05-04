/* eslint-disable @typescript-eslint/consistent-type-imports -- DTO как классы для ValidationPipe */
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
import { UserRole } from '@podocare/shared-types';

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { Roles } from '../../auth/infrastructure/roles.decorator';
import { RolesGuard } from '../../auth/infrastructure/roles.guard';
import { AdminCatalogService } from '../application/admin-catalog.service';
import { AdminSpecialistsService } from '../application/admin-specialists.service';
import { AdminStaffService } from '../application/admin-staff.service';
import { CreateFaqItemDto } from './dto/create-faq-item.dto';
import { CreateHealthConcernDto } from './dto/create-health-concern.dto';
import { CreateNetworkDto } from './dto/create-network.dto';
import { CreateSpecialistDto } from './dto/create-specialist.dto';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { CreateStudioDto } from './dto/create-studio.dto';
import { ListSpecialistsQueryDto } from './dto/list-specialists.query.dto';
import { ListStaffQueryDto } from './dto/list-staff.query.dto';
import { ListStudiosQueryDto } from './dto/list-studios.query.dto';
import { UpdateFaqItemDto } from './dto/update-faq-item.dto';
import { UpdateHealthConcernDto } from './dto/update-health-concern.dto';
import { UpdateNetworkDto } from './dto/update-network.dto';
import { UpdateSpecialistDto } from './dto/update-specialist.dto';
import { UpdateStaffUserDto } from './dto/update-staff-user.dto';
import { UpdateStudioDto } from './dto/update-studio.dto';

import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';

const ADMIN_CATALOG_ROLES = [
  UserRole.NetworkOwner,
  UserRole.StudioAdmin,
  UserRole.SuperAdmin,
] as const;

@ApiTags('admin-catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_CATALOG_ROLES)
@Controller('admin/catalog')
export class AdminCatalogController {
  constructor(
    private readonly adminCatalogService: AdminCatalogService,
    private readonly adminStaffService: AdminStaffService,
    private readonly adminSpecialistsService: AdminSpecialistsService,
  ) {}

  // --- Networks ---

  @Get('networks')
  @ApiOperation({ summary: 'Список сетей (StudioAdmin — только своя)' })
  listNetworks(@CurrentUser() user: JwtAccessPayload) {
    return this.adminCatalogService.listNetworks(user);
  }

  @Get('networks/:id')
  @ApiOperation({ summary: 'Сеть по id' })
  getNetwork(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminCatalogService.getNetwork(user, id);
  }

  @Post('networks')
  @ApiOperation({ summary: 'Создать сеть (SuperAdmin / NetworkOwner)' })
  createNetwork(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateNetworkDto) {
    return this.adminCatalogService.createNetwork(user, dto);
  }

  @Patch('networks/:id')
  @ApiOperation({ summary: 'Обновить сеть (SuperAdmin / NetworkOwner)' })
  updateNetwork(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNetworkDto,
  ) {
    return this.adminCatalogService.updateNetwork(user, id, dto);
  }

  @Delete('networks/:id')
  @ApiOperation({ summary: 'Удалить сеть без студий (SuperAdmin / NetworkOwner)' })
  deleteNetwork(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminCatalogService.deleteNetwork(user, id);
  }

  // --- Studios ---

  @Get('studios')
  @ApiOperation({ summary: 'Список студий (StudioAdmin — только своя)' })
  listStudios(@CurrentUser() user: JwtAccessPayload, @Query() q: ListStudiosQueryDto) {
    return this.adminCatalogService.listStudios(user, q);
  }

  @Get('studios/:id')
  @ApiOperation({ summary: 'Студия по id' })
  getStudio(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminCatalogService.getStudio(user, id);
  }

  @Post('studios')
  @ApiOperation({ summary: 'Создать студию (SuperAdmin / NetworkOwner)' })
  createStudio(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateStudioDto) {
    return this.adminCatalogService.createStudio(user, dto);
  }

  @Patch('studios/:id')
  @ApiOperation({ summary: 'Обновить студию (StudioAdmin — только свою, без смены сети)' })
  updateStudio(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudioDto,
  ) {
    return this.adminCatalogService.updateStudio(user, id, dto);
  }

  @Delete('studios/:id')
  @ApiOperation({ summary: 'Удалить студию (SuperAdmin / NetworkOwner)' })
  deleteStudio(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminCatalogService.deleteStudio(user, id);
  }

  // --- Health concerns ---

  @Get('health-concerns')
  @ApiOperation({ summary: 'Справочник жалоб (что беспокоит)' })
  listHealthConcerns() {
    return this.adminCatalogService.listHealthConcerns();
  }

  @Get('health-concerns/:id')
  @ApiOperation({ summary: 'Жалоба по id' })
  getHealthConcern(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminCatalogService.getHealthConcern(id);
  }

  @Post('health-concerns')
  @ApiOperation({ summary: 'Создать запись (SuperAdmin / NetworkOwner)' })
  createHealthConcern(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateHealthConcernDto) {
    return this.adminCatalogService.createHealthConcern(user, dto);
  }

  @Patch('health-concerns/:id')
  @ApiOperation({ summary: 'Обновить запись (SuperAdmin / NetworkOwner)' })
  updateHealthConcern(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHealthConcernDto,
  ) {
    return this.adminCatalogService.updateHealthConcern(user, id, dto);
  }

  @Delete('health-concerns/:id')
  @ApiOperation({ summary: 'Удалить запись (SuperAdmin / NetworkOwner)' })
  deleteHealthConcern(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminCatalogService.deleteHealthConcern(user, id);
  }

  // --- FAQ ---

  @Get('faq-items')
  @ApiOperation({ summary: 'Все пункты FAQ (включая неактивные)' })
  listFaqItems() {
    return this.adminCatalogService.listFaqItems();
  }

  @Get('faq-items/:id')
  @ApiOperation({ summary: 'Пункт FAQ по id' })
  getFaqItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminCatalogService.getFaqItem(id);
  }

  @Post('faq-items')
  @ApiOperation({ summary: 'Создать пункт FAQ (SuperAdmin / NetworkOwner)' })
  createFaqItem(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateFaqItemDto) {
    return this.adminCatalogService.createFaqItem(user, dto);
  }

  @Patch('faq-items/:id')
  @ApiOperation({ summary: 'Обновить пункт FAQ (SuperAdmin / NetworkOwner)' })
  updateFaqItem(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFaqItemDto,
  ) {
    return this.adminCatalogService.updateFaqItem(user, id, dto);
  }

  @Delete('faq-items/:id')
  @ApiOperation({ summary: 'Удалить пункт FAQ (SuperAdmin / NetworkOwner)' })
  deleteFaqItem(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminCatalogService.deleteFaqItem(user, id);
  }

  // --- Специалисты ---

  @Get('specialists')
  @ApiOperation({ summary: 'Список специалистов' })
  listSpecialists(@CurrentUser() user: JwtAccessPayload, @Query() q: ListSpecialistsQueryDto) {
    return this.adminSpecialistsService.list(user, q);
  }

  @Get('specialists/:id')
  @ApiOperation({ summary: 'Специалист по id' })
  getSpecialist(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminSpecialistsService.getById(user, id);
  }

  @Post('specialists')
  @ApiOperation({ summary: 'Создать специалиста' })
  createSpecialist(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateSpecialistDto) {
    return this.adminSpecialistsService.create(user, dto);
  }

  @Patch('specialists/:id')
  @ApiOperation({ summary: 'Обновить специалиста' })
  updateSpecialist(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpecialistDto,
  ) {
    return this.adminSpecialistsService.update(user, id, dto);
  }

  @Delete('specialists/:id')
  @ApiOperation({ summary: 'Деактивировать специалиста' })
  deleteSpecialist(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminSpecialistsService.deactivate(user, id);
  }

  // --- Staff (сотрудники, без специалистов) ---

  @Get('staff')
  @ApiOperation({ summary: 'Список сотрудников (StudioAdmin — только своя студия)' })
  listStaff(@CurrentUser() user: JwtAccessPayload, @Query() q: ListStaffQueryDto) {
    return this.adminStaffService.list(user, q);
  }

  @Get('staff/:id')
  @ApiOperation({ summary: 'Сотрудник по id' })
  getStaff(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminStaffService.getById(user, id);
  }

  @Post('staff')
  @ApiOperation({ summary: 'Создать учётную запись сотрудника' })
  createStaff(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateStaffUserDto) {
    return this.adminStaffService.create(user, dto);
  }

  @Patch('staff/:id')
  @ApiOperation({ summary: 'Обновить сотрудника' })
  updateStaff(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffUserDto,
  ) {
    return this.adminStaffService.update(user, id, dto);
  }

  @Delete('staff/:id')
  @ApiOperation({ summary: 'Деактивировать сотрудника (учётная запись остаётся в БД)' })
  deleteStaff(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminStaffService.deactivate(user, id);
  }
}
