import { Module } from '@nestjs/common';
import { GenexusClientModule } from '../../core/genexus-client/genexus-client.module.js';
import { DeviceModule } from '../device/device.module.js';
import { PosProductosModule } from '../pos-productos/pos-productos.module.js';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { PosCarritoService } from './pos-carrito.service.js';
import { PosCarritoController } from './pos-carrito.controller.js';

@Module({
  imports: [
    GenexusClientModule, // PosCarritoService → GenexusClientService
    DeviceModule, // PosContextGuard + tokenGen → DeviceService
    PosProductosModule, // PosCarritoService → PosProductosService (orquestación OmniBox)
  ],
  providers: [PosCarritoService, PosContextGuard],
  controllers: [PosCarritoController],
  exports: [PosCarritoService], // consumido por OmniboxRouterService
})
export class PosCarritoModule {}
