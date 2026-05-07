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
import { UserRole } from '@srs/shared-types';

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { Roles } from '../../auth/infrastructure/roles.decorator';
import { RolesGuard } from '../../auth/infrastructure/roles.guard';
import { AdminCatalogService } from '../application/admin-catalog.service';
import { AdminPhysicalGoodsService } from '../application/admin-physical-goods.service';
import { AdminServiceCategoriesService } from '../application/admin-service-categories.service';
import { AdminSpecialistShiftsService } from '../application/admin-specialist-shifts.service';
import { AdminSpecialistsService } from '../application/admin-specialists.service';
import { AdminStaffService } from '../application/admin-staff.service';
import { AdminStudioServicesService } from '../application/admin-studio-services.service';
import { CreateFaqItemDto } from './dto/create-faq-item.dto';
import { CreateHealthConcernDto } from './dto/create-health-concern.dto';
import { CreateNetworkDto } from './dto/create-network.dto';
import { CreatePhysicalGoodCategoryDto } from './dto/create-physical-good-category.dto';
import { CreatePhysicalGoodDto } from './dto/create-physical-good.dto';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { CreateSpecialistShiftDto } from './dto/create-specialist-shift.dto';
import { CreateSpecialistShiftsBulkDto } from './dto/create-specialist-shifts-bulk.dto';
import { CreateSpecialistDto } from './dto/create-specialist.dto';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { CreateStudioDirectionDto } from './dto/create-studio-direction.dto';
import { CreateStudioServiceDto } from './dto/create-studio-service.dto';
import { CreateStudioDto } from './dto/create-studio.dto';
import { ListSpecialistShiftsQueryDto } from './dto/list-specialist-shifts.query.dto';
import { ListSpecialistsQueryDto } from './dto/list-specialists.query.dto';
import { ListStaffQueryDto } from './dto/list-staff.query.dto';
import { ListStudiosQueryDto } from './dto/list-studios.query.dto';
import { UpdateFaqItemDto } from './dto/update-faq-item.dto';
import { UpdateHealthConcernDto } from './dto/update-health-concern.dto';
import { UpdateNetworkDto } from './dto/update-network.dto';
import { UpdatePhysicalGoodCategoryDto } from './dto/update-physical-good-category.dto';
import { UpdatePhysicalGoodDto } from './dto/update-physical-good.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { UpdateSpecialistShiftDto } from './dto/update-specialist-shift.dto';
import { UpdateSpecialistDto } from './dto/update-specialist.dto';
import { UpdateStaffUserDto } from './dto/update-staff-user.dto';
import { UpdateStudioDirectionDto } from './dto/update-studio-direction.dto';
import { UpdateStudioServiceDto } from './dto/update-studio-service.dto';
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
    private readonly adminStudioServicesService: AdminStudioServicesService,
    private readonly adminServiceCategoriesService: AdminServiceCategoriesService,
    private readonly adminPhysicalGoodsService: AdminPhysicalGoodsService,
    private readonly adminSpecialistShiftsService: AdminSpecialistShiftsService,
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

  // --- Услуги студии ---

  @Get('studios/:studioId/services')
  @ApiOperation({ summary: 'Услуги студии (все, для админки)' })
  listStudioServices(
    @CurrentUser() user: JwtAccessPayload,
    @Param('studioId', ParseUUIDPipe) studioId: string,
  ) {
    return this.adminStudioServicesService.list(user, studioId);
  }

  @Get('studios/:studioId/services/:serviceId')
  @ApiOperation({ summary: 'Услуга по id' })
  getStudioService(
    @CurrentUser() user: JwtAccessPayload,
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.adminStudioServicesService.getById(user, studioId, serviceId);
  }

  @Post('studios/:studioId/services')
  @ApiOperation({ summary: 'Создать услугу в студии' })
  createStudioService(
    @CurrentUser() user: JwtAccessPayload,
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Body() dto: CreateStudioServiceDto,
  ) {
    return this.adminStudioServicesService.create(user, studioId, dto);
  }

  @Patch('studios/:studioId/services/:serviceId')
  @ApiOperation({ summary: 'Обновить услугу' })
  updateStudioService(
    @CurrentUser() user: JwtAccessPayload,
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() dto: UpdateStudioServiceDto,
  ) {
    return this.adminStudioServicesService.update(user, studioId, serviceId, dto);
  }

  @Delete('studios/:studioId/services/:serviceId')
  @ApiOperation({ summary: 'Удалить услугу' })
  deleteStudioService(
    @CurrentUser() user: JwtAccessPayload,
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.adminStudioServicesService.delete(user, studioId, serviceId);
  }

  // --- Health concerns ---

  @Get('networks/:networkId/physical-good-categories')
  @ApiOperation({ summary: 'Категории товаров сети (включая неактивные)' })
  listPhysicalGoodCategories(
    @CurrentUser() user: JwtAccessPayload,
    @Param('networkId', ParseUUIDPipe) networkId: string,
  ) {
    return this.adminPhysicalGoodsService.listCategories(user, networkId);
  }

  @Post('networks/:networkId/physical-good-categories')
  @ApiOperation({ summary: 'Создать категорию товаров' })
  createPhysicalGoodCategory(
    @CurrentUser() user: JwtAccessPayload,
    @Param('networkId', ParseUUIDPipe) networkId: string,
    @Body() dto: CreatePhysicalGoodCategoryDto,
  ) {
    return this.adminPhysicalGoodsService.createCategory(user, networkId, dto);
  }

  @Patch('networks/:networkId/physical-good-categories/:categoryId')
  @ApiOperation({ summary: 'Обновить категорию товаров' })
  updatePhysicalGoodCategory(
    @CurrentUser() user: JwtAccessPayload,
    @Param('networkId', ParseUUIDPipe) networkId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdatePhysicalGoodCategoryDto,
  ) {
    return this.adminPhysicalGoodsService.updateCategory(user, networkId, categoryId, dto);
  }

  @Delete('networks/:networkId/physical-good-categories/:categoryId')
  @ApiOperation({ summary: 'Удалить категорию товаров' })
  deletePhysicalGoodCategory(
    @CurrentUser() user: JwtAccessPayload,
    @Param('networkId', ParseUUIDPipe) networkId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.adminPhysicalGoodsService.deleteCategory(user, networkId, categoryId);
  }

  @Get('networks/:networkId/physical-goods')
  @ApiOperation({ summary: 'Товары сети (включая неактивные)' })
  listPhysicalGoods(
    @CurrentUser() user: JwtAccessPayload,
    @Param('networkId', ParseUUIDPipe) networkId: string,
  ) {
    return this.adminPhysicalGoodsService.list(user, networkId);
  }

  @Get('networks/:networkId/physical-goods/:goodId')
  @ApiOperation({ summary: 'Товар по id' })
  getPhysicalGood(
    @CurrentUser() user: JwtAccessPayload,
    @Param('networkId', ParseUUIDPipe) networkId: string,
    @Param('goodId', ParseUUIDPipe) goodId: string,
  ) {
    return this.adminPhysicalGoodsService.getById(user, networkId, goodId);
  }

  @Post('networks/:networkId/physical-goods')
  @ApiOperation({ summary: 'Создать товар в сети' })
  createPhysicalGood(
    @CurrentUser() user: JwtAccessPayload,
    @Param('networkId', ParseUUIDPipe) networkId: string,
    @Body() dto: CreatePhysicalGoodDto,
  ) {
    return this.adminPhysicalGoodsService.create(user, networkId, dto);
  }

  @Patch('networks/:networkId/physical-goods/:goodId')
  @ApiOperation({ summary: 'Обновить товар' })
  updatePhysicalGood(
    @CurrentUser() user: JwtAccessPayload,
    @Param('networkId', ParseUUIDPipe) networkId: string,
    @Param('goodId', ParseUUIDPipe) goodId: string,
    @Body() dto: UpdatePhysicalGoodDto,
  ) {
    return this.adminPhysicalGoodsService.update(user, networkId, goodId, dto);
  }

  @Delete('networks/:networkId/physical-goods/:goodId')
  @ApiOperation({ summary: 'Удалить товар' })
  deletePhysicalGood(
    @CurrentUser() user: JwtAccessPayload,
    @Param('networkId', ParseUUIDPipe) networkId: string,
    @Param('goodId', ParseUUIDPipe) goodId: string,
  ) {
    return this.adminPhysicalGoodsService.delete(user, networkId, goodId);
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

  // --- Studio directions ---

  @Get('studio-directions')
  @ApiOperation({ summary: 'Направления студии (блок на главной в приложении)' })
  listStudioDirections() {
    return this.adminCatalogService.listStudioDirections();
  }

  @Get('studio-directions/:id')
  @ApiOperation({ summary: 'Направление по id' })
  getStudioDirection(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminCatalogService.getStudioDirection(id);
  }

  @Post('studio-directions')
  @ApiOperation({ summary: 'Создать направление (SuperAdmin / NetworkOwner)' })
  createStudioDirection(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateStudioDirectionDto) {
    return this.adminCatalogService.createStudioDirection(user, dto);
  }

  @Patch('studio-directions/:id')
  @ApiOperation({ summary: 'Обновить направление (SuperAdmin / NetworkOwner)' })
  updateStudioDirection(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudioDirectionDto,
  ) {
    return this.adminCatalogService.updateStudioDirection(user, id, dto);
  }

  @Delete('studio-directions/:id')
  @ApiOperation({ summary: 'Удалить направление (SuperAdmin / NetworkOwner)' })
  deleteStudioDirection(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminCatalogService.deleteStudioDirection(user, id);
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

  // --- Категории услуг (направления деятельности) ---

  @Get('service-categories')
  @ApiOperation({ summary: 'Все категории услуг' })
  listServiceCategories() {
    return this.adminServiceCategoriesService.list();
  }

  @Get('service-categories/:id')
  @ApiOperation({ summary: 'Категория по id' })
  getServiceCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminServiceCategoriesService.getById(id);
  }

  @Post('service-categories')
  @ApiOperation({ summary: 'Создать категорию (SuperAdmin / NetworkOwner)' })
  createServiceCategory(@CurrentUser() user: JwtAccessPayload, @Body() dto: CreateServiceCategoryDto) {
    return this.adminServiceCategoriesService.create(user, dto);
  }

  @Patch('service-categories/:id')
  @ApiOperation({ summary: 'Обновить категорию (SuperAdmin / NetworkOwner)' })
  updateServiceCategory(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceCategoryDto,
  ) {
    return this.adminServiceCategoriesService.update(user, id, dto);
  }

  @Delete('service-categories/:id')
  @ApiOperation({ summary: 'Удалить категорию (SuperAdmin / NetworkOwner)' })
  deleteServiceCategory(@CurrentUser() user: JwtAccessPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminServiceCategoriesService.delete(user, id);
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

  @Get('specialists/:id/shifts')
  @ApiOperation({ summary: 'Смены специалиста (дата и время работы)' })
  listSpecialistShifts(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: ListSpecialistShiftsQueryDto,
  ) {
    return this.adminSpecialistShiftsService.list(user, id, q);
  }

  @Post('specialists/:id/shifts')
  @ApiOperation({ summary: 'Добавить смену специалисту' })
  createSpecialistShift(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSpecialistShiftDto,
  ) {
    return this.adminSpecialistShiftsService.create(user, id, dto);
  }

  @Patch('specialists/:id/shifts/:shiftId')
  @ApiOperation({ summary: 'Редактировать смену специалиста' })
  updateSpecialistShift(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
    @Body() dto: UpdateSpecialistShiftDto,
  ) {
    return this.adminSpecialistShiftsService.update(user, id, shiftId, dto);
  }

  @Post('specialists/:id/shifts/bulk')
  @ApiOperation({ summary: 'Массово добавить смены по шаблону недели' })
  createSpecialistShiftsBulk(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSpecialistShiftsBulkDto,
  ) {
    return this.adminSpecialistShiftsService.createBulk(user, id, dto);
  }

  @Delete('specialists/:id/shifts/:shiftId')
  @ApiOperation({ summary: 'Удалить смену специалиста' })
  deleteSpecialistShift(
    @CurrentUser() user: JwtAccessPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
  ) {
    return this.adminSpecialistShiftsService.delete(user, id, shiftId);
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
