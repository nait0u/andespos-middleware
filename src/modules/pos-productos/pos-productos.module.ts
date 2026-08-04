import { Module } from '@nestjs/common';
import { GenexusClientModule } from '../../core/genexus-client/genexus-client.module.js';
import { DispositivoModule } from '@andestec/api-dispositivos';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { PosProductosService } from './pos-productos.service.js';
import { PosProductosController } from './pos-productos.controller.js';

@Module({
  imports: [GenexusClientModule, DispositivoModule],
  providers: [PosProductosService, PosContextGuard],
  controllers: [PosProductosController],
  exports: [PosProductosService], // consumido por PosCarritoService (orquestación OmniBox)
})
export class PosProductosModule {}
