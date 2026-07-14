import { Module } from '@nestjs/common';
import { DeviceModule } from '../device/device.module.js';
import { PosCarritoModule } from '../pos-carrito/pos-carrito.module.js';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { OmniboxRouterService } from './omnibox-router.service.js';
import { PosOmniboxController } from './pos-omnibox.controller.js';

@Module({
  imports: [
    DeviceModule, // PosContextGuard → DeviceService
    PosCarritoModule, // OmniboxRouterService → PosCarritoService
  ],
  providers: [OmniboxRouterService, PosContextGuard],
  controllers: [PosOmniboxController],
})
export class PosOmniboxModule {}
