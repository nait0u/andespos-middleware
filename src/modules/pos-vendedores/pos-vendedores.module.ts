import { Module } from '@nestjs/common';
import { GenexusClientModule } from '../../core/genexus-client/genexus-client.module.js';
import { DispositivoModule } from '@andestec/api-dispositivos';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { PosVendedoresService } from './pos-vendedores.service.js';
import { PosVendedoresController } from './pos-vendedores.controller.js';

@Module({
  imports: [GenexusClientModule, DispositivoModule],
  providers: [PosVendedoresService, PosContextGuard],
  controllers: [PosVendedoresController],
})
export class PosVendedoresModule {}
