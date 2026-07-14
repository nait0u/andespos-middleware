import { Module } from '@nestjs/common';
import { GenexusClientModule } from '../../core/genexus-client/genexus-client.module.js';
import { DeviceModule } from '../device/device.module.js';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { ClientesService } from './clientes.service.js';
import { ClientesController } from './clientes.controller.js';

@Module({
  imports: [
    GenexusClientModule,
    DeviceModule,
  ],
  providers: [ClientesService, PosContextGuard],
  controllers: [ClientesController],
})
export class ClientesModule {}
