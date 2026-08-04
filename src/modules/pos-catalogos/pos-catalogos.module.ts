import { Module } from '@nestjs/common';
import { GenexusClientModule } from '../../core/genexus-client/genexus-client.module.js';
import { DispositivoModule } from '@andestec/api-dispositivos';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { PosCatalogosService } from './pos-catalogos.service.js';
import { PosCatalogosController } from './pos-catalogos.controller.js';

@Module({
  imports: [GenexusClientModule, DispositivoModule],
  providers: [PosCatalogosService, PosContextGuard],
  controllers: [PosCatalogosController],
})
export class PosCatalogosModule {}
