import { Module } from '@nestjs/common';
import { DispositivoModule } from '@andestec/api-dispositivos';
import { JwtPerfilamientoModule } from '@andestec/jwt-perfilamiento';
import { SetsessionController } from './setsession.controller.js';
import { SetsessionService } from './setsession.service.js';
import { PerfilamientoPublicKeyUrlResolverModule } from './perfilamiento-public-key-url-resolver.module.js';

/**
 * `DispositivoModule` trae registrado `PersistenciaModule` (@Global) — por eso
 * no se importa Redis de nuevo aquí, ya está disponible en toda la app desde
 * `app.module.ts`. Se re-importa solo para que este módulo sea explícito sobre
 * su dependencia real de `PersistenciaService`.
 *
 * `PerfilamientoPublicKeyUrlResolverModule` (ver ese archivo) registra el
 * binding de `PUBLIC_KEY_URL_RESOLVER` de forma global — es lo que hace que
 * `PublicKeyLoaderService`, dentro del scope de `JwtPerfilamientoModule`, pueda
 * verlo.
 */
@Module({
  imports: [JwtPerfilamientoModule, DispositivoModule, PerfilamientoPublicKeyUrlResolverModule],
  controllers: [SetsessionController],
  providers: [SetsessionService],
})
export class SetsessionModule {}
