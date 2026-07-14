import { Module } from '@nestjs/common';
import { GenexusClientModule } from '../../core/genexus-client/genexus-client.module.js';
import { DeviceModule } from '../device/device.module.js';
import { BalanzaContextStore } from './balanza-context.store.js';
import { BalanzaGateway } from './balanza.gateway.js';
import { BalanzaListenerService } from './balanza-listener.service.js';

@Module({
  imports: [
    GenexusClientModule, // BalanzaListenerService → GenexusClientService
    DeviceModule, // tokenGen → DeviceService
  ],
  providers: [BalanzaContextStore, BalanzaGateway, BalanzaListenerService],
})
export class BalanzaModule {}
