import { Module } from '@nestjs/common';
import { GenexusClientModule } from '../../core/genexus-client/genexus-client.module.js';
import { DispositivoModule } from '@andestec/api-dispositivos';
import { BalanzaContextStore } from './balanza-context.store.js';
import { BalanzaGateway } from './balanza.gateway.js';
import { BalanzaListenerService } from './balanza-listener.service.js';

@Module({
  imports: [
    GenexusClientModule, // BalanzaListenerService → GenexusClientService
    DispositivoModule, // TokenGen → TokenService
  ],
  providers: [BalanzaContextStore, BalanzaGateway, BalanzaListenerService],
})
export class BalanzaModule {}
