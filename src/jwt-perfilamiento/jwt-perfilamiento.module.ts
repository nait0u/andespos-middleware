import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PublicKeyLoaderService } from './services/public-key-loader.service.js';
import { JwtVerificationService } from './services/jwt-verification.service.js';
import { JwtMapperService } from './services/jwt-mapper.service.js';
import { AlcanceResolverService } from './services/alcance-resolver.service.js';
import { SessionVariablesService } from './services/session-variables.service.js';

/**
 * Librería de servicios inyectables para validar/mapear JWT RS256 de
 * Perfilamiento (AC) — sin controladores, sin persistencia de sesión (eso es
 * responsabilidad de la app consumidora). Configuración 100% por env vars
 * (ver `constants.ts`), sin depender de ningún otro paquete `@andestec/*`.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), HttpModule],
  providers: [
    PublicKeyLoaderService,
    JwtVerificationService,
    JwtMapperService,
    AlcanceResolverService,
    SessionVariablesService,
  ],
  exports: [
    PublicKeyLoaderService,
    JwtVerificationService,
    JwtMapperService,
    AlcanceResolverService,
    SessionVariablesService,
  ],
})
export class JwtPerfilamientoModule {}
