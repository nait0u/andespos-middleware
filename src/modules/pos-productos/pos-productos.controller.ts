import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { ContextoPOS } from '../../common/decorators/pos-context.decorator.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import { PosProductosService } from './pos-productos.service.js';
import { ResolverOmniboxDto } from './dto/resolver-omnibox.dto.js';

@UseGuards(PosContextGuard)
@Controller('api/pos')
export class PosProductosController {
  constructor(private readonly productosService: PosProductosService) {}

  /**
   * GET /api/pos/omnibox/resolver?codigoEscaneado=
   * Resuelve un código escaneado/digitado a ProductoKey + flags de lote.
   * 404 si el código no resuelve a ningún producto.
   */
  @Get('omnibox/resolver')
  async resolverOmnibox(
    @Query() query: ResolverOmniboxDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    return this.productosService.resolverOmnibox(ctx, query.codigoEscaneado);
  }

  /**
   * GET /api/pos/productos/:productoKey/lotes
   * 404 si el producto no tiene lotes vigentes.
   */
  @Get('productos/:productoKey/lotes')
  async getLotesPorProducto(
    @Param('productoKey', ParseIntPipe) productoKey: number,
    @ContextoPOS() ctx: IPosContext,
  ) {
    return {
      lotes: await this.productosService.obtenerLotesPorProducto(
        ctx,
        productoKey,
      ),
    };
  }
}
