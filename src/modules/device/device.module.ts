import { Module } from '@nestjs/common';
import { DispositivoModule } from '@andestec/api-dispositivos';
import { DeviceController } from './device.controller.js';

@Module({
  imports: [DispositivoModule],
  controllers: [DeviceController],
})
export class DeviceModule {}
