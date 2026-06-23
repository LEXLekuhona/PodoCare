/* eslint-disable @typescript-eslint/consistent-type-imports -- DTO classes for @Body() metadata */
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { AuthService } from '../application/auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { StaffLoginDto } from './dto/staff-login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

const IS_TEST = process.env.NODE_ENV === 'test';
const OTP_REQUEST_LIMIT = IS_TEST ? 10_000 : 5;
const OTP_VERIFY_LIMIT = IS_TEST ? 10_000 : 10;
const STAFF_LOGIN_LIMIT = IS_TEST ? 10_000 : 10;
const THROTTLE_TTL_MS = 60_000;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: OTP_REQUEST_LIMIT, ttl: THROTTLE_TTL_MS } })
  @ApiOperation({ summary: 'Запрашивает OTP код для входа клиента по телефону.' })
  requestOtp(@Body() body: RequestOtpDto) {
    return this.authService.requestOtp(body);
  }
  @Post('otp/verify')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: OTP_VERIFY_LIMIT, ttl: THROTTLE_TTL_MS } })
  @ApiOperation({ summary: 'Проверяет OTP и выдаёт пару токенов + профиль пользователя.' })
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(body);
  }

  @Post('staff/login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: STAFF_LOGIN_LIMIT, ttl: THROTTLE_TTL_MS } })
  @ApiOperation({ summary: 'Логин сотрудника по email + password.' })
  staffLogin(@Body() body: StaffLoginDto) {
    return this.authService.loginStaff(body);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Ротирует access/refresh токены по refresh token.' })
  refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Отзывает текущую refresh-сессию.' })
  async logout(@Body() body: RefreshTokenDto): Promise<void> {
    await this.authService.logout(body.refreshToken);
  }
}
