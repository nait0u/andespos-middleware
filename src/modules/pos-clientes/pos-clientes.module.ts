import { Module } from '@nestjs/common';
import { GenexusClientModule } from '../../core/genexus-client/genexus-client.module.js';
import { DispositivoModule } from '@andestec/api-dispositivos';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { PosClientesService } from './pos-clientes.service.js';
import { PosClientesController } from './pos-clientes.controller.js';

@Module({
  imports: [GenexusClientModule, DispositivoModule],
  providers: [PosClientesService, PosContextGuard],
  controllers: [PosClientesController],
})
export class PosClientesModule {}
