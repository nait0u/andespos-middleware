import { Module } from '@nestjs/common';
import { ParametrosModule } from '@andestec/api-parametros';
import { ParameterController } from './parameter.controller.js';

@Module({
  imports: [ParametrosModule],
  controllers: [ParameterController],
})
export class ParameterModule {}
