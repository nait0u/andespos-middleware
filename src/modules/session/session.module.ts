import { Module } from '@nestjs/common';
import { DispositivoModule } from '@andestec/api-dispositivos';
import { ParameterModule } from '../parameter/parameter.module.js';
import { SessionController } from './session.controller.js';

@Module({
  imports: [DispositivoModule, ParameterModule],
  controllers: [SessionController],
})
export class SessionModule {}
