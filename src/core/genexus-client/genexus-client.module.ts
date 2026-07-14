import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GenexusClientService } from './genexus-client.service.js';
import { DeviceModule } from '../../modules/device/device.module.js';

@Module({
  imports: [HttpModule, forwardRef(() => DeviceModule)],
  providers: [GenexusClientService],
  exports: [GenexusClientService],
})
export class GenexusClientModule {}
