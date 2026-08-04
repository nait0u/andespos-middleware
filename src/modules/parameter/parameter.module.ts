import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DispositivoModule } from '@andestec/api-dispositivos';
import { ParameterController } from './parameter.controller.js';
import { ParameterService } from './parameter.service.js';

@Module({
  imports: [HttpModule, DispositivoModule],
  controllers: [ParameterController],
  providers: [ParameterService],
  exports: [ParameterService],
})
export class ParameterModule {}
