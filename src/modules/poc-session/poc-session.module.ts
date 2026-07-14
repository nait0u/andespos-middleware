import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GenexusClientModule } from '../../core/genexus-client/genexus-client.module.js';
import { PocSessionController } from './poc-session.controller.js';
import { PocSessionService } from './poc-session.service.js';

@Module({
  imports: [HttpModule, GenexusClientModule],
  controllers: [PocSessionController],
  providers: [PocSessionService],
})
export class PocSessionModule {}
