import { Module, forwardRef } from '@nestjs/common';
import { GenexusClientModule } from '../../core/genexus-client/genexus-client.module.js';
import { DeviceController } from './device.controller.js';
import { DeviceService } from './device.service.js';

@Module({
  imports: [forwardRef(() => GenexusClientModule)],
  controllers: [DeviceController],
  providers: [DeviceService],
  exports: [DeviceService],
})
export class DeviceModule {}
