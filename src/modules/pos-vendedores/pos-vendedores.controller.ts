import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { ContextoPOS } from '../../common/decorators/pos-context.decorator.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import { PosVendedoresService } from './pos-vendedores.service.js';
import { ListaVendedoresDto } from './dto/lista-vendedores.dto.js';

@UseGuards(PosContextGuard)
@Controller('api/pos/vendedores')
export class PosVendedoresController {
  constructor(private readonly vendedoresService: PosVendedoresService) {}

  /**
   * GET /api/pos/vendedores?vendedorKey=&vendedorExige=&filtroOmniBox=&filtroGenerico=
   * EmpKey/PuntoAccesoKey se toman del contexto POS — GeneXus filtra a
   * nivel de backend por la ubicación (PuntoAccesoKey) del terminal.
   */
  @Get()
  async getVendedores(
    @Query() query: ListaVendedoresDto,
    @ContextoPOS() ctx: IPosContext,
  ) {
    return {
      vendedores: await this.vendedoresService.obtenerVendedores(ctx, query),
    };
  }
}
