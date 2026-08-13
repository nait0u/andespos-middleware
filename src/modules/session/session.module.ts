import { Module } from '@nestjs/common';
import { DispositivoModule } from '@andestec/api-dispositivos';
import { SessionController } from './session.controller.js';

@Module({
  imports: [DispositivoModule],
  controllers: [SessionController],
})
export class SessionModule {}
