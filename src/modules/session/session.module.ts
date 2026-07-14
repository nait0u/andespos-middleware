import { Module } from '@nestjs/common';
import { DeviceModule } from '../device/device.module.js';
import { ParameterModule } from '../parameter/parameter.module.js';
import { SessionController } from './session.controller.js';

@Module({
  imports: [DeviceModule, ParameterModule],
  controllers: [SessionController],
})
export class SessionModule {}
