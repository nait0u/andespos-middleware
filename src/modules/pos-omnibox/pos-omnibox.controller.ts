import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { ContextoPOS } from '../../common/decorators/pos-context.decorator.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import { OmniboxRouterService } from './omnibox-router.service.js';
import { ProcesarOmniboxDto } from './dto/procesar-omnibox.dto.js';

@UseGuards(PosContextGuard)
@Controller('api/pos/omnibox')
export class PosOmniboxController {
  constructor(private readonly router: OmniboxRouterService) {}

  /**
   * POST /api/pos/omnibox/procesar
   * Router heurístico del único input de texto del OmniBox: clasifica el
   * string crudo (QR / comando rápido / cantidad / código / texto libre) y
   * devuelve una acción única para que React reaccione vía switch/reducer.
   * Ver OmniboxRouterService para el detalle de cada fase.
   */
  @Post('procesar')
  async procesar(
    @Body() dto: ProcesarOmniboxDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    return this.router.procesar(ctx, dto);
  }
}
