import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DeviceModule } from './modules/device/device.module.js';
import { ParameterModule } from './modules/parameter/parameter.module.js';
import { SessionModule } from './modules/session/session.module.js';
import { VentasModule } from './modules/ventas/ventas.module.js';
import { PreciosModule } from './modules/precios/precios.module.js';
import { PocSessionModule } from './modules/poc-session/poc-session.module.js';
import { ClientesModule } from './modules/clientes/clientes.module.js';
import { PosProductosModule } from './modules/pos-productos/pos-productos.module.js';
import { PosCarritoModule } from './modules/pos-carrito/pos-carrito.module.js';
import { PosOmniboxModule } from './modules/pos-omnibox/pos-omnibox.module.js';
import { PosCatalogosModule } from './modules/pos-catalogos/pos-catalogos.module.js';
import { PosClientesModule } from './modules/pos-clientes/pos-clientes.module.js';
import { PosVendedoresModule } from './modules/pos-vendedores/pos-vendedores.module.js';
import { BalanzaModule } from './modules/balanza/balanza.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DeviceModule,
    ParameterModule,
    SessionModule,
    VentasModule,
    PreciosModule,
    PocSessionModule,
    ClientesModule,
    PosProductosModule,
    PosCarritoModule,
    PosOmniboxModule,
    PosCatalogosModule,
    PosClientesModule,
    PosVendedoresModule,
    BalanzaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
