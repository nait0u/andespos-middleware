import { Module } from '@nestjs/common';
import { GenexusClientModule } from '../../core/genexus-client/genexus-client.module.js';
import { DeviceModule } from '../device/device.module.js';
import { ParameterModule } from '../parameter/parameter.module.js';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { PreciosService } from './precios.service.js';
import { PreciosController } from './precios.controller.js';

@Module({
  imports: [
    GenexusClientModule, // PreciosService → GenexusClientService
    DeviceModule,        // PosContextGuard → DeviceService
    ParameterModule,     // PreciosService → ParameterService (resolución de Parmtransconf)
  ],
  providers: [PreciosService, PosContextGuard],
  controllers: [PreciosController],
})
export class PreciosModule {}
