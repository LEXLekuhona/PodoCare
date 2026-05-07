/* eslint-disable import/order */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@srs/shared-types';

import { CurrentUser } from '../../auth/infrastructure/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/jwt-auth.guard';
import { Roles } from '../../auth/infrastructure/roles.decorator';
import { RolesGuard } from '../../auth/infrastructure/roles.guard';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Nest DI metadata requires runtime import
import { SupportService } from '../application/support.service';
// Nest ValidationPipe relies on runtime metadata for DTO classes.
// `import type` breaks `design:paramtypes`, causing whitelist validation to reject all properties.
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import type { JwtAccessPayload } from '../../auth/infrastructure/jwt.strategy';

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @Roles(UserRole.Client)
  @ApiOperation({ summary: 'Клиент создаёт тикет в поддержку (первое сообщение внутри).' })
  createTicket(@CurrentUser() user: JwtAccessPayload, @Body() body: CreateSupportTicketDto) {
    return this.supportService.createTicketForClient(user.sub, body);
  }
}

