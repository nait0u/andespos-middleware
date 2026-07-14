import { Module } from '@nestjs/common';
import { GenexusClientModule } from '../../core/genexus-client/genexus-client.module.js';
import { DeviceModule } from '../device/device.module.js';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { PosVendedoresService } from './pos-vendedores.service.js';
import { PosVendedoresController } from './pos-vendedores.controller.js';

@Module({
  imports: [GenexusClientModule, DeviceModule],
  providers: [PosVendedoresService, PosContextGuard],
  controllers: [PosVendedoresController],
})
export class PosVendedoresModule {}
