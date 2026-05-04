import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './application/auth.service';
import { JwtStrategy } from './infrastructure/jwt.strategy';
import { RolesGuard } from './infrastructure/roles.guard';
import { AuthController } from './presentation/auth.controller';
import { CryptoModule } from '../../infrastructure/crypto/crypto.module';

@Module({
  imports: [PassportModule, JwtModule.register({}), CryptoModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard],
  exports: [JwtModule, PassportModule, RolesGuard],
})
export class AuthModule {}
