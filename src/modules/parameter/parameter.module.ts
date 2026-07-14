import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DeviceModule } from '../device/device.module.js';
import { ParameterController } from './parameter.controller.js';
import { ParameterService } from './parameter.service.js';

@Module({
  imports: [HttpModule, DeviceModule],
  controllers: [ParameterController],
  providers: [ParameterService],
  exports: [ParameterService],
})
export class ParameterModule {}
