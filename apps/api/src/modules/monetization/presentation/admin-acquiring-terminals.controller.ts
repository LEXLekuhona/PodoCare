import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@srs/shared-types';

import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { Roles } from '../../auth/infrastructure/roles.decorator';
import { RolesGuard } from '../../auth/infrastructure/roles.guard';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { AcquiringTerminalsService } from '../application/acquiring-terminals.service';

import type { CreateAcquiringTerminalDto } from './dto/create-acquiring-terminal.dto';
import type { UpdateAcquiringTerminalDto } from './dto/update-acquiring-terminal.dto';

@ApiTags('admin-acquiring')
@Controller('admin/acquiring-terminals')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(UserRole.SuperAdmin)
export class AdminAcquiringTerminalsController {
  constructor(private readonly acquiringTerminals: AcquiringTerminalsService) {}

  @Get()
  @ApiOperation({ summary: 'Список терминалов эквайринга (только SuperAdmin)' })
  list() {
    return this.acquiringTerminals.list();
  }

  @Post()
  @ApiOperation({ summary: 'Добавить терминал' })
  create(@Body() dto: CreateAcquiringTerminalDto) {
    return this.acquiringTerminals.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить терминал' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAcquiringTerminalDto) {
    return this.acquiringTerminals.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить терминал' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.acquiringTerminals.remove(id);
  }
}
