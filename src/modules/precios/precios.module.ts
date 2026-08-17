import { Module } from '@nestjs/common';
import { GenexusClientModule } from '../../core/genexus-client/genexus-client.module.js';
import { DispositivoModule } from '@andestec/api-dispositivos';
import { PosParametrosModule } from '@andestec/api-parametros-pos';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { PreciosService } from './precios.service.js';
import { PreciosController } from './precios.controller.js';

@Module({
  imports: [
    GenexusClientModule,  // PreciosService → GenexusClientService
    DispositivoModule,    // PosContextGuard → TokenService
    PosParametrosModule,  // PreciosService → PosParametrosService (GetFormatosUpload)
  ],
  providers: [PreciosService, PosContextGuard],
  controllers: [PreciosController],
})
export class PreciosModule {}
