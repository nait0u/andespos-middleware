import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DispositivoModule } from '@andestec/api-dispositivos';
import { GenexusClientService } from './genexus-client.service.js';

@Module({
  imports: [HttpModule, DispositivoModule],
  providers: [GenexusClientService],
  exports: [GenexusClientService],
})
export class GenexusClientModule {}
