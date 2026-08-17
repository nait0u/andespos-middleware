import { Global, Module } from '@nestjs/common';
import { PerfilamientoParametrosModule } from '@andestec/api-parametros-perfilamiento';
import { PUBLIC_KEY_URL_RESOLVER } from '@andestec/jwt-perfilamiento';
import { PerfilamientoPublicKeyUrlResolver } from './perfilamiento-public-key-url.resolver.js';

/**
 * `PublicKeyLoaderService` vive dentro del scope de `JwtPerfilamientoModule`, no
 * de `SetsessionModule` — un provider registrado en el módulo que *importa* no es
 * visible para los providers del módulo *importado* (la dirección de visibilidad
 * en NestJS es la contraria). `@Global()` es lo que permite que este binding de
 * `PUBLIC_KEY_URL_RESOLVER` llegue al injector de `PublicKeyLoaderService` sin que
 * `jwt-perfilamiento` tenga que importar nada de este módulo.
 */
@Global()
@Module({
  imports: [PerfilamientoParametrosModule],
  providers: [
    PerfilamientoPublicKeyUrlResolver,
    { provide: PUBLIC_KEY_URL_RESOLVER, useExisting: PerfilamientoPublicKeyUrlResolver },
  ],
  exports: [PUBLIC_KEY_URL_RESOLVER],
})
export class PerfilamientoPublicKeyUrlResolverModule {}
