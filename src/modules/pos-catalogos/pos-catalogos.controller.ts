import { Controller, Get, UseGuards } from '@nestjs/common';
import { PosContextGuard } from '../../common/guards/pos-context.guard.js';
import { ContextoPOS } from '../../common/decorators/pos-context.decorator.js';
import type { IPosContext } from '../../common/interfaces/pos-context.interface.js';
import { PosCatalogosService } from './pos-catalogos.service.js';

/**
 * PosCatalogosController — combos de dominio para el frontend (xVenta).
 * EmpKey se toma siempre del contexto POS (@ContextoPOS), nunca de query
 * params: GeneXus lo requiere en todos estos endpoints para resolver el
 * catálogo vigente de la empresa, aunque el esquema lo marque opcional.
 */
@UseGuards(PosContextGuard)
@Controller('api/pos/catalogos')
export class PosCatalogosController {
  constructor(private readonly catalogosService: PosCatalogosService) {}

  @Get('tratamiento-tributario')
  async getTratamientoTributario(@ContextoPOS() ctx: IPosContext) {
    return {
      items: await this.catalogosService.obtenerTratamientoTributario(ctx),
    };
  }

  @Get('unidades-medida')
  async getUnidadesMedida(@ContextoPOS() ctx: IPosContext) {
    return { items: await this.catalogosService.obtenerUnidadesMedida(ctx) };
  }

  @Get('impuestos-especiales')
  async getImpuestosEspeciales(@ContextoPOS() ctx: IPosContext) {
    return {
      items: await this.catalogosService.obtenerImpuestosEspeciales(ctx),
    };
  }

  @Get('motivos-traslado')
  async getMotivosTraslado(@ContextoPOS() ctx: IPosContext) {
    return { items: await this.catalogosService.obtenerMotivosTraslado(ctx) };
  }

  @Get('tipos-traslado')
  async getTiposTraslado(@ContextoPOS() ctx: IPosContext) {
    return { items: await this.catalogosService.obtenerTiposTraslado(ctx) };
  }

  @Get('actividades-economicas')
  async getActividadesEconomicas(@ContextoPOS() ctx: IPosContext) {
    return {
      items: await this.catalogosService.obtenerActividadesEconomicas(ctx),
    };
  }
}
