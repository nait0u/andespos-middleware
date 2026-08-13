import { Module } from '@nestjs/common';
import { DispositivoModule } from '@andestec/api-dispositivos';
import { JwtPerfilamientoModule } from '../../jwt-perfilamiento/index.js';
import { SetsessionController } from './setsession.controller.js';
import { SetsessionService } from './setsession.service.js';

/**
 * `DispositivoModule` trae registrado `PersistenciaModule` (@Global) — por eso
 * no se importa Redis de nuevo aquí, ya está disponible en toda la app desde
 * `app.module.ts`. Se re-importa solo para que este módulo sea explícito sobre
 * su dependencia real de `PersistenciaService`.
 */
@Module({
  imports: [JwtPerfilamientoModule, DispositivoModule],
  controllers: [SetsessionController],
  providers: [SetsessionService],
})
export class SetsessionModule {}
