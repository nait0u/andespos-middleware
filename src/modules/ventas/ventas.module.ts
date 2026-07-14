import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { GenexusClientModule } from '../../core/genexus-client/genexus-client.module.js';
import { DeviceModule } from '../device/device.module.js';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { VentasService } from './ventas.service.js';
import { VentasController } from './ventas.controller.js';

@Module({
  imports: [
    GenexusClientModule, // VentasService → GenexusClientService
    DeviceModule, // PosContextGuard → DeviceService
    CacheModule.register({ ttl: 3600000 }),
  ],
  providers: [VentasService, PosContextGuard],
  controllers: [VentasController],
})
export class VentasModule {}
